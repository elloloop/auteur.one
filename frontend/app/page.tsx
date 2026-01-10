"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@/components/editor/Canvas";
import { Timeline } from "@/components/editor/Timeline";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Header } from "@/components/editor/Header";
import { audioManager } from "@/lib/audio-engine";
import { Clip, Track } from "@/lib/types";
import { EFFECTS } from "@/lib/effects";
import { TEMPLATES, Template } from "@/lib/templates";

// Constants
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const DEFAULT_CLIP_DURATION = 4;

export default function Editor() {
    // State
    const [hasProject, setHasProject] = useState(false);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [clips, setClips] = useState<Clip[]>([]);
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
    const [timelineHeight, setTimelineHeight] = useState(320);
    const [isResizingTimeline, setIsResizingTimeline] = useState(false);

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

        // Render Logic Extracted to Canvas Component via Props/Effect or here?
        // Ideally render logic stays close. We'll duplicate render loop logic strictly for Canvas use.
        // For now, we will assume Canvas component handles rendering if we pass the context?
        // Actually, logic is complex. We will implement render function here to pass to Canvas or keep in Canvas.
        // Let's rely on the Canvas component to update based on props for now, OR we pass a render function ref.
        // REFACTOR: We'll put the render logic inside the Canvas component's useEffect/Animation loop.
        // However, for centralized control, let's keep the time loop here and just force update the canvas? 
        // React re-renders are too slow for 60fps canvas. We need a ref-based render.

        // We will call a render function on the Canvas module if possible, or just implement it here.
        // Implementing here for direct access to state refs without prop drilling hell.
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

        // Clear
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const currentClips = clipsRef.current;
        const currentTracks = tracksRef.current;
        const sortedTracks = [...currentTracks].reverse();

        sortedTracks.forEach(track => {
            if (track.mute) return;
            const trackClips = currentClips.filter(c => c.trackId === track.id);
            trackClips.forEach(clip => {
                if (time >= clip.start && time < (clip.start + clip.duration)) {
                    ctx.save();
                    const opacity = clip.params.opacity ?? 1.0;
                    const scale = clip.params.scale ?? 1.0;
                    const posX = clip.params.x ?? 0;
                    const posY = clip.params.y ?? 0;

                    ctx.globalAlpha = opacity;
                    ctx.translate(CANVAS_WIDTH / 2 + posX, CANVAS_HEIGHT / 2 + posY);
                    ctx.scale(scale, scale);
                    ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);

                    if (EFFECTS[clip.type]) {
                        EFFECTS[clip.type].render(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, time, clip.params, clip);
                    } else if (clip.type === 'image' && clip.src) {
                        // Image loading logic would go here. For now simpler placeholder.
                        ctx.fillStyle = '#333'; ctx.fillRect(100, 100, 400, 300);
                    }
                    ctx.restore();
                }
            });
        });

        // Audio Logic Sync
        if (isPlayingRef.current) {
            currentClips.forEach(clip => {
                const track = currentTracks.find(t => t.id === clip.trackId);
                if (!track?.mute) {
                    const inRange = time >= clip.start && time < (clip.start + clip.duration);
                    if (inRange) {
                        const offset = time - clip.start;
                        if (offset >= 0 && offset < 0.1) {
                            audioManager.playClip(clip.id, offset, clip.params);
                        }
                    } else {
                        audioManager.stopNode(clip.id);
                    }
                }
            })
        } else {
            audioManager.stopAll();
        }
    };

    // Actions
    const createProject = (template?: Template) => {
        if (template) {
            setTracks(template.state.tracks);
            setClips(template.state.clips);
            setDuration(template.state.duration);
        } else {
            setTracks([
                { id: 't_d1', name: 'Dialogue', type: 'dialogue', mute: false },
                { id: 't_v1', name: 'Visuals', type: 'visual', mute: false },
                { id: 't_a1', name: 'Music', type: 'audio', mute: false }
            ]);
            setClips([]);
            setDuration(30);
        }
        setHasProject(true);
        audioManager.init();
    };

    const addTrack = (type: any) => {
        const id = Math.random().toString(36).substr(2, 9);
        const name = type.charAt(0).toUpperCase() + type.slice(1);
        setTracks(prev => [...prev, { id, name, type, mute: false }]);
        setAddTrackModal(false);
    };

    const handleFileDrop = (e: any, trackId: string, time = 0) => {
        // Implementation stub for file drop
        const newClip: Clip = {
            id: Math.random().toString(36).substr(2, 9),
            trackId,
            type: 'visual',
            name: 'New Clip',
            start: time,
            duration: 4,
            takes: [],
            activeTakeId: null,
            params: { opacity: 1, scale: 1 }
        };
        setClips(prev => [...prev, newClip]);
    };

    const updateClip = (id: string, field: keyof Clip, value: any) => {
        setClips(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const updateClipParam = (id: string, param: string, value: any) => {
        setClips(prev => prev.map(c => c.id === id ? { ...c, params: { ...c.params, [param]: value } } : c));
    };

    const splitClip = () => {
        if (!selectedClipId) return;
        const clip = clips.find(c => c.id === selectedClipId);
        if (!clip || currentTime <= clip.start || currentTime >= clip.start + clip.duration) return;
        // Split logic...
    };

    // Effects for Dragging
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging || !timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const currentX = e.clientX - rect.left; // Needs adjustment for scroll container usually
            const deltaPx = currentX - dragging.startX;
            const pxPerSec = 50 * zoom;
            const deltaSec = deltaPx / pxPerSec;

            if (dragging.type === 'move') {
                const newStart = Math.max(0, dragging.originalStart + deltaSec);
                updateClip(dragging.clipId, 'start', newStart);
            } else if (dragging.type === 'resize') {
                const newDuration = Math.max(0.5, dragging.originalDuration + deltaSec);
                updateClip(dragging.clipId, 'duration', newDuration);
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
    }, [dragging, zoom]);

    // Timeline Resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingTimeline) {
                const newHeight = window.innerHeight - e.clientY;
                setTimelineHeight(Math.max(150, Math.min(newHeight, window.innerHeight - 200)));
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
                        {TEMPLATES.map(template => (
                            <button
                                key={template.id}
                                onClick={() => createProject(template)}
                                className="group relative overflow-hidden rounded-xl border border-slate-800 hover:border-slate-600 transition-all text-left p-6 h-48 bg-slate-800/50 hover:bg-slate-800"
                            >
                                <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${template.thumbnailColor} group-hover:opacity-20 transition-opacity`} />
                                <div className="relative z-10 flex flex-col h-full">
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

    return (
        <div className="h-screen flex flex-col bg-slate-900 overflow-hidden text-slate-200">
            <Header onExport={() => setIsExporting(true)} isExporting={isExporting} />

            <div className="flex-1 flex overflow-hidden">
                <PropertiesPanel
                    selectedClip={clips.find(c => c.id === selectedClipId)}
                    updateClip={updateClip}
                    updateClipParam={updateClipParam}
                    splitClip={splitClip}
                    isRecording={isRecording}
                    startRecording={() => setIsRecording(true)}
                    stopRecording={() => setIsRecording(false)}
                    handleFileDrop={handleFileDrop}
                />

                <div className="flex-1 flex flex-col min-w-0 bg-black">
                    <Canvas
                        canvasRef={canvasRef}
                        currentTime={currentTime}
                        duration={duration}
                        isPlaying={isPlaying}
                        setIsPlaying={setIsPlaying}
                        setCurrentTime={setCurrentTime}
                        currentClips={clips}
                        currentTracks={tracks}
                        audioManager={audioManager}
                        isExporting={isExporting}
                        exportProgress={exportProgress}
                    />

                    {/* Resize Handle */}
                    <div
                        className="h-1 bg-slate-800 hover:bg-indigo-500 cursor-row-resize transition-colors z-20"
                        onMouseDown={() => setIsResizingTimeline(true)}
                    />

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
                        handleTimelineMouseDown={(e, id, type) => {
                            const clip = clips.find(c => c.id === id);
                            if (clip && timelineRef.current) {
                                const rect = timelineRef.current.getBoundingClientRect();
                                setDragging({ type, clipId: id, startX: e.clientX - rect.left, originalStart: clip.start, originalDuration: clip.duration });
                                setSelectedClipId(id);
                            }
                        }}
                        handleTimelineDoubleClick={() => { }}
                        selectedClipId={selectedClipId}
                        timelineRef={timelineRef}
                        height={timelineHeight}
                    />
                </div>
            </div>

            {addTrackModal && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-96 shadow-2xl space-y-4">
                        <h3 className="text-white font-bold text-lg">Add New Track</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {['visual', 'audio', 'dialogue', 'snow', 'glitch'].map(type => (
                                <button key={type} onClick={() => addTrack(type)} className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left capitalize">
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
