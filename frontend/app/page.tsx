"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@/components/editor/Canvas";
import { Timeline } from "@/components/editor/Timeline";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Header } from "@/components/editor/Header";
import { audioManager } from "@/lib/audio-engine";
import { videoExporter } from "@/lib/video-export";
import { Clip, Track, Speaker, Take } from "@/lib/types";
import { EFFECTS } from "@/lib/effects";
import { TEMPLATES, Template } from "@/lib/templates";

// Constants
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const DEFAULT_CLIP_DURATION = 4;
const DEFAULT_GAP_MS = 200;

export default function Editor() {
    // State
    const [hasProject, setHasProject] = useState(false);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [clips, setClips] = useState<Clip[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [duration, setDuration] = useState(30);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [addTrackModal, setAddTrackModal] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [dragging, setDragging] = useState<{ type: 'move' | 'resize', clipId: string, startX: number, originalStart: number, originalDuration: number } | null>(null);
    const [timelineHeight, setTimelineHeight] = useState(400);
    const [propertiesPanelWidth, setPropertiesPanelWidth] = useState(320);
    const [isResizingTimeline, setIsResizingTimeline] = useState(false);
    const [isResizingProperties, setIsResizingProperties] = useState(false);
    const [rippleMode, setRippleMode] = useState(false);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();
    const isPlayingRef = useRef(isPlaying);
    const currentTimeRef = useRef(currentTime);
    const lastTimeRef = useRef(0);
    const tracksRef = useRef(tracks);
    const clipsRef = useRef(clips);
    const durationRef = useRef(duration);

    // Sync Refs
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
    useEffect(() => { tracksRef.current = tracks; }, [tracks]);
    useEffect(() => { clipsRef.current = clips; }, [clips]);
    useEffect(() => { durationRef.current = duration; }, [duration]);

    // Animation Loop
    const animate = useCallback((timestamp: number) => {
        if (!canvasRef.current) return;

        if (!isExporting && isPlayingRef.current) {
            if (!lastTimeRef.current) lastTimeRef.current = timestamp;
            const delta = (timestamp - lastTimeRef.current) / 1000;
            lastTimeRef.current = timestamp;

            let newTime = currentTimeRef.current + delta;
            if (newTime > durationRef.current) newTime = 0;

            currentTimeRef.current = newTime;
            setCurrentTime(newTime);
        } else if (!isPlayingRef.current && !isExporting) {
            lastTimeRef.current = 0;
        }

        renderFrame(currentTimeRef.current);
        requestRef.current = requestAnimationFrame(animate);
    }, [isExporting]);

    useEffect(() => {
        if (hasProject && !isExporting) requestRef.current = requestAnimationFrame(animate);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [hasProject, isExporting, animate]);

    const renderFrame = (time: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const currentClips = clipsRef.current;
        const currentTracks = tracksRef.current;
        const sortedTracks = [...currentTracks].sort((a, b) => a.order - b.order);

        sortedTracks.forEach(track => {
            if (track.mute) return;
            const trackClips = currentClips.filter(c => c.trackId === track.id);
            trackClips.forEach(clip => {
                if (time >= clip.start && time < (clip.start + clip.duration)) {
                    if (EFFECTS[clip.type]) {
                        EFFECTS[clip.type].render(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, time, clip.params, clip);
                    }
                }
            });
        });

        // Audio playback sync
        if (isPlayingRef.current) {
            currentClips.forEach(clip => {
                const track = currentTracks.find(t => t.id === clip.trackId);
                if (!track?.mute && (clip.type === 'audio' || clip.type === 'dialogue')) {
                    const inRange = time >= clip.start && time < (clip.start + clip.duration);
                    if (inRange) {
                        const offset = time - clip.start;
                        if (offset >= 0 && offset < 0.1) {
                            // Get active audio source
                            let audioSource: string | Blob | undefined;
                            if (clip.activeTakeId && clip.takes) {
                                const activeTake = clip.takes.find(t => t.id === clip.activeTakeId);
                                if (activeTake) {
                                    audioSource = activeTake.uri || activeTake.blob;
                                }
                            }
                            if (audioSource) {
                                audioManager.playClip(clip.id, offset, clip.params, audioSource);
                            }
                        }
                    } else {
                        audioManager.stopNode(clip.id);
                    }
                }
            });
        } else {
            audioManager.stopAll();
        }
    };

    // Overlap detection
    const checkOverlap = (clipId: string, newStart: number, newDuration: number): boolean => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip) return false;

        const track = tracks.find(t => t.id === clip.trackId);
        if (!track || !track.rules || track.rules.overlap_policy === 'allow') return false;

        const trackClips = clips.filter(c => c.trackId === clip.trackId && c.id !== clipId);
        const newEnd = newStart + newDuration;

        return trackClips.some(other => {
            const otherEnd = other.start + other.duration;
            return !(newEnd <= other.start || newStart >= otherEnd);
        });
    };

    // Ripple edit - shift downstream clips
    const rippleEdit = (trackId: string, afterTime: number, deltaTime: number) => {
        if (!rippleMode) return;

        setClips(prev => prev.map(clip => {
            if (clip.trackId === trackId && clip.start >= afterTime) {
                return { ...clip, start: Math.max(0, clip.start + deltaTime) };
            }
            return clip;
        }));
    };

    // Actions
    const createProject = (template?: Template) => {
        if (template) {
            const newTracks: Track[] = template.tracks.map((t, index) => ({
                ...t,
                id: `t_${Math.random().toString(36).substr(2, 9)}`,
                order: index,
            }));
            setTracks(newTracks);
            setClips([]);
            setDuration(template.duration);
            setSpeakers(template.speakers || []);
        } else {
            setTracks([
                {
                    id: 't_d1',
                    name: 'Dialogue',
                    type: 'dialogue',
                    order: 0,
                    mute: false,
                    volume: 1.0,
                    bus: 'dialogue',
                    rules: {
                        overlap_policy: 'disallow',
                        default_gap_ms: DEFAULT_GAP_MS,
                        snap: true,
                        ripple_mode: false,
                    },
                    ui: {
                        collapsed: false,
                        height_px: 88,
                    },
                },
                {
                    id: 't_v1',
                    name: 'Visuals',
                    type: 'video',
                    order: 1,
                    mute: false,
                    volume: 1.0,
                    ui: {
                        collapsed: false,
                        height_px: 88,
                    },
                },
                {
                    id: 't_a1',
                    name: 'Music',
                    type: 'audio',
                    order: 2,
                    mute: false,
                    volume: 0.3,
                    ui: {
                        collapsed: false,
                        height_px: 64,
                    },
                },
            ]);
            setClips([]);
            setDuration(30);
            setSpeakers([
                {
                    id: 'default',
                    name: 'Default Speaker',
                    voiceProfile: {
                        pitch: 0,
                        rate: 1.0,
                        volume: 1.0,
                    },
                    color: '#3b82f6',
                },
            ]);
        }
        setHasProject(true);
        audioManager.init();
    };

    const addTrack = (type: Track['type']) => {
        const id = `t_${Math.random().toString(36).substr(2, 9)}`;
        const name = type.charAt(0).toUpperCase() + type.slice(1);
        const newTrack: Track = {
            id,
            name,
            type,
            order: tracks.length,
            mute: false,
            volume: 1.0,
            ui: {
                collapsed: false,
                height_px: type === 'dialogue' ? 88 : 64,
            },
        };

        if (type === 'dialogue') {
            newTrack.rules = {
                overlap_policy: 'disallow',
                default_gap_ms: DEFAULT_GAP_MS,
                snap: true,
            };
            newTrack.bus = 'dialogue';
        }

        setTracks(prev => [...prev, newTrack]);
        setAddTrackModal(false);
    };

    const addDialogueClip = (trackId: string, time: number = currentTime) => {
        const track = tracks.find(t => t.id === trackId);
        if (!track || track.type !== 'dialogue') return;

        const newClip: Clip = {
            id: `c_${Math.random().toString(36).substr(2, 9)}`,
            trackId,
            type: 'dialogue',
            name: 'New Dialogue',
            start: time,
            duration: 2, // Will update when audio is added
            speaker: speakers[0]?.id || 'default',
            content: '',
            scriptText: '',
            takes: [],
            params: {
                volume: 1.0,
                pitch: 0,
                speed: 1.0,
            },
        };

        setClips(prev => [...prev, newClip]);
        setSelectedClipId(newClip.id);
    };

    const handleFileDrop = (e: React.DragEvent, trackId: string, time: number = 0) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);

        files.forEach(file => {
            const track = tracks.find(t => t.id === trackId);
            if (!track) return;

            let clipType: Clip['type'] = 'video';
            if (file.type.startsWith('image/')) clipType = 'picture';
            else if (file.type.startsWith('audio/')) clipType = 'audio';
            else if (file.type.startsWith('video/')) clipType = 'video';

            const newClip: Clip = {
                id: `c_${Math.random().toString(36).substr(2, 9)}`,
                trackId,
                type: clipType,
                name: file.name,
                start: time,
                duration: DEFAULT_CLIP_DURATION,
                src: URL.createObjectURL(file),
                file: file,
                params: {
                    volume: 1.0,
                    opacity: 1.0,
                    scaleX: 1.0,
                    scaleY: 1.0,
                },
            };

            setClips(prev => [...prev, newClip]);
        });
    };

    const updateClip = (id: string, field: keyof Clip, value: any) => {
        setClips(prev => prev.map(c => {
            if (c.id === id) {
                const updated = { ...c, [field]: value };

                // Handle text changes for dialogue - mark as stale
                if (field === 'content' || field === 'scriptText') {
                    const textHash = btoa(value || '');
                    if (c.textVersionHash && c.textVersionHash !== textHash) {
                        updated.isStale = true;
                    }
                    updated.textVersionHash = textHash;
                }

                return updated;
            }
            return c;
        }));
    };

    const updateClipParam = (id: string, param: string, value: any) => {
        setClips(prev => prev.map(c => c.id === id ? { ...c, params: { ...c.params, [param]: value } } : c));
    };

    const splitClip = () => {
        if (!selectedClipId) return;
        const clip = clips.find(c => c.id === selectedClipId);
        if (!clip || currentTime <= clip.start || currentTime >= clip.start + clip.duration) return;

        const splitPoint = currentTime - clip.start;
        const newClip: Clip = {
            ...clip,
            id: `c_${Math.random().toString(36).substr(2, 9)}`,
            start: currentTime,
            duration: clip.duration - splitPoint,
        };

        updateClip(clip.id, 'duration', splitPoint);
        setClips(prev => [...prev, newClip]);
    };

    const startRecording = async (clipId: string) => {
        try {
            setIsRecording(true);
            await audioManager.startRecording();
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Could not access microphone. Please check permissions.');
            setIsRecording(false);
        }
    };

    const stopRecording = async (clipId: string) => {
        try {
            const blob = await audioManager.stopRecording();
            const duration = await audioManager.getAudioDuration(blob);
            const waveformPeaks = await audioManager.generateWaveformPeaks(blob);

            const newTake: Take = {
                id: `take_${Math.random().toString(36).substr(2, 9)}`,
                blob,
                duration,
                createdAt: Date.now(),
                source: 'recording',
                waveformPeaks,
                name: `Take ${(clips.find(c => c.id === clipId)?.takes?.length || 0) + 1}`,
            };

            setClips(prev => prev.map(c => {
                if (c.id === clipId) {
                    const takes = [...(c.takes || []), newTake];
                    return {
                        ...c,
                        takes,
                        activeTakeId: newTake.id,
                        duration: newTake.duration,
                    };
                }
                return c;
            }));

            setIsRecording(false);
        } catch (error) {
            console.error('Failed to stop recording:', error);
            setIsRecording(false);
        }
    };

    const uploadTake = async (clipId: string, file: File) => {
        try {
            const blob = new Blob([await file.arrayBuffer()], { type: file.type });
            const duration = await audioManager.getAudioDuration(blob);
            const waveformPeaks = await audioManager.generateWaveformPeaks(blob);

            const newTake: Take = {
                id: `take_${Math.random().toString(36).substr(2, 9)}`,
                blob,
                duration,
                createdAt: Date.now(),
                source: 'upload',
                waveformPeaks,
                name: file.name,
            };

            setClips(prev => prev.map(c => {
                if (c.id === clipId) {
                    const takes = [...(c.takes || []), newTake];
                    return {
                        ...c,
                        takes,
                        activeTakeId: newTake.id,
                        duration: newTake.duration,
                    };
                }
                return c;
            }));
        } catch (error) {
            console.error('Failed to upload take:', error);
            alert('Failed to upload audio file.');
        }
    };

    const deleteTake = (clipId: string, takeId: string) => {
        setClips(prev => prev.map(c => {
            if (c.id === clipId) {
                const takes = (c.takes || []).filter(t => t.id !== takeId);
                const activeTakeId = c.activeTakeId === takeId
                    ? (takes.length > 0 ? takes[0].id : undefined)
                    : c.activeTakeId;
                return { ...c, takes, activeTakeId };
            }
            return c;
        }));
    };

    const exportVideo = async () => {
        if (!canvasRef.current || !videoExporter) {
            alert('Export functionality not available.');
            return;
        }

        try {
            setIsExporting(true);
            setExportProgress(0);

            const blob = await videoExporter.exportVideo(
                canvasRef.current,
                clips,
                tracks,
                speakers,
                duration,
                30,
                (progress) => setExportProgress(progress)
            );

            // Download the video
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `auteur-video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Also export subtitles
            const srt = await videoExporter.exportSubtitles(clips, speakers);
            if (srt) {
                const srtBlob = new Blob([srt], { type: 'text/plain' });
                const srtUrl = URL.createObjectURL(srtBlob);
                const srtLink = document.createElement('a');
                srtLink.href = srtUrl;
                srtLink.download = `auteur-subtitles-${Date.now()}.srt`;
                document.body.appendChild(srtLink);
                srtLink.click();
                document.body.removeChild(srtLink);
                URL.revokeObjectURL(srtUrl);
            }

            // Also export audio stem
            const audioBlob = await videoExporter.exportAudioStem(clips, tracks, duration);
            if (audioBlob && audioBlob.size > 0) {
                const audioUrl = URL.createObjectURL(audioBlob);
                const audioLink = document.createElement('a');
                audioLink.href = audioUrl;
                audioLink.download = `auteur-audio-${Date.now()}.webm`;
                document.body.appendChild(audioLink);
                audioLink.click();
                document.body.removeChild(audioLink);
                URL.revokeObjectURL(audioUrl);
            }

        } catch (error) {
            console.error('Export failed:', error);
            alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsExporting(false);
            setExportProgress(0);
        }
    };

    const addSpeaker = () => {
        const newSpeaker: Speaker = {
            id: `speaker_${Math.random().toString(36).substr(2, 9)}`,
            name: `Speaker ${speakers.length + 1}`,
            voiceProfile: {
                pitch: 0,
                rate: 1.0,
                volume: 1.0,
            },
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        };
        setSpeakers(prev => [...prev, newSpeaker]);
    };

    // Timeline Resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingTimeline) {
                const newHeight = window.innerHeight - e.clientY;
                const clampedHeight = Math.max(150, Math.min(newHeight, window.innerHeight - 200));
                setTimelineHeight(clampedHeight);
            }
        };
        const handleMouseUp = () => setIsResizingTimeline(false);

        if (isResizingTimeline) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingTimeline]);

    // Properties Panel Resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingProperties) {
                const newWidth = e.clientX;
                setPropertiesPanelWidth(Math.max(250, Math.min(newWidth, 600)));
            }
        };
        const handleMouseUp = () => setIsResizingProperties(false);

        if (isResizingProperties) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingProperties]);

    // Clip Dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging || !timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const deltaPx = currentX - dragging.startX;
            const pxPerSec = 50 * zoom;
            const deltaSec = deltaPx / pxPerSec;

            if (dragging.type === 'move') {
                const newStart = Math.max(0, dragging.originalStart + deltaSec);
                const clip = clips.find(c => c.id === dragging.clipId);
                if (clip && !checkOverlap(dragging.clipId, newStart, clip.duration)) {
                    updateClip(dragging.clipId, 'start', newStart);
                }
            } else if (dragging.type === 'resize') {
                const newDuration = Math.max(0.5, dragging.originalDuration + deltaSec);
                const clip = clips.find(c => c.id === dragging.clipId);
                if (clip && !checkOverlap(dragging.clipId, clip.start, newDuration)) {
                    updateClip(dragging.clipId, 'duration', newDuration);
                }
            }
        };
        const handleMouseUp = () => setDragging(null);
        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, zoom, clips]);

    // Initial View
    if (!hasProject) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
                <div className="text-center space-y-8 animate-fade-in">
                    <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 tracking-tighter">Auteur.one</h1>
                    <p className="text-slate-400 text-lg">Professional-grade storytelling in your browser.</p>
                    <button onClick={() => createProject()} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-indigo-500/20 transition-all transform hover:-translate-y-1">
                        New Blank Project
                    </button>

                    <div className="grid grid-cols-3 gap-6 pt-8 max-w-4xl mx-auto">
                        {TEMPLATES.filter(t => t.id !== 'blank').map(template => (
                            <button
                                key={template.id}
                                onClick={() => createProject(template)}
                                className="group relative overflow-hidden rounded-xl border border-slate-800 hover:border-slate-600 transition-all text-left p-6 h-48 bg-slate-800/50 hover:bg-slate-800"
                            >
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="text-4xl mb-3">{template.icon}</div>
                                    <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
                                    <p className="text-slate-400 text-sm">{template.description}</p>
                                    <div className="mt-auto flex items-center text-indigo-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Use Template →
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const selectedClip = clips.find(c => c.id === selectedClipId);

    return (
        <div className="h-screen flex flex-col bg-slate-900 overflow-hidden text-slate-200">
            <Header
                onExport={exportVideo}
                isExporting={isExporting}
                rippleMode={rippleMode}
                setRippleMode={setRippleMode}
                speakers={speakers}
                addSpeaker={addSpeaker}
            />

            <div className="flex-1 flex overflow-hidden">
                <div className="flex" style={{ width: propertiesPanelWidth }}>
                    <PropertiesPanel
                        selectedClip={selectedClip}
                        updateClip={updateClip}
                        updateClipParam={updateClipParam}
                        splitClip={splitClip}
                        isRecording={isRecording}
                        startRecording={() => selectedClip && startRecording(selectedClip.id)}
                        stopRecording={() => selectedClip && stopRecording(selectedClip.id)}
                        uploadTake={selectedClip ? (file) => uploadTake(selectedClip.id, file) : undefined}
                        deleteTake={selectedClip ? (takeId) => deleteTake(selectedClip.id, takeId) : undefined}
                        speakers={speakers}
                    />
                    <div
                        className="w-3 bg-slate-800 hover:bg-indigo-600 cursor-col-resize transition-all flex items-center justify-center group border-x border-slate-700 hover:border-indigo-500 relative"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsResizingProperties(true);
                        }}
                        style={{ userSelect: 'none', zIndex: 50 }}
                    >
                        <div className="w-1 h-16 bg-slate-600 rounded-full group-hover:bg-indigo-300 transition-colors shadow-sm pointer-events-none"></div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 bg-black overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <Canvas
                            canvasRef={canvasRef}
                            currentTime={currentTime}
                            duration={duration}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            setCurrentTime={setCurrentTime}
                            isExporting={isExporting}
                            exportProgress={exportProgress}
                        />
                    </div>

                    <div
                        className="h-3 bg-slate-800 hover:bg-indigo-600 cursor-row-resize transition-all flex items-center justify-center group border-y border-slate-700 hover:border-indigo-500 relative shrink-0"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsResizingTimeline(true);
                        }}
                        style={{ userSelect: 'none', zIndex: 50 }}
                    >
                        <div className="w-16 h-1 bg-slate-600 rounded-full group-hover:bg-indigo-300 transition-colors shadow-sm pointer-events-none"></div>
                    </div>

                    <Timeline
                        tracks={tracks}
                        clips={clips}
                        duration={duration}
                        currentTime={currentTime}
                        zoom={zoom}
                        setZoom={setZoom}
                        setTracks={setTracks}
                        setAddTrackModal={setAddTrackModal}
                        handleFileDrop={handleFileDrop}
                        addDialogueClip={addDialogueClip}
                        handleTimelineMouseDown={(e, id, type) => {
                            const clip = clips.find(c => c.id === id);
                            if (clip && timelineRef.current) {
                                const rect = timelineRef.current.getBoundingClientRect();
                                setDragging({
                                    type,
                                    clipId: id,
                                    startX: e.clientX - rect.left,
                                    originalStart: clip.start,
                                    originalDuration: clip.duration
                                });
                                setSelectedClipId(id);
                            }
                        }}
                        selectedClipId={selectedClipId}
                        setSelectedClipId={setSelectedClipId}
                        timelineRef={timelineRef}
                        height={timelineHeight}
                        speakers={speakers}
                    />
                </div>
            </div>

            {addTrackModal && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-96 shadow-2xl space-y-4">
                        <h3 className="text-white font-bold text-lg">Add New Track</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {(['video', 'audio', 'dialogue', 'picture', 'text'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => addTrack(type)}
                                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left capitalize transition-colors"
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setAddTrackModal(false)} className="w-full py-2 text-slate-500 hover:text-white text-sm">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
