import { Clip, Track, Speaker } from "@/lib/types";
import { EFFECTS } from "@/lib/effects";
import { Plus, ZoomIn, MessageSquare, Music, Film, VolumeX, Volume2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface TimelineProps {
    tracks: Track[];
    clips: Clip[];
    duration: number;
    currentTime: number;
    zoom: number;
    setZoom: (z: number) => void;
    setTracks: (t: Track[]) => void;
    setAddTrackModal: (open: boolean) => void;
    handleFileDrop: (e: any, trackId: string, time?: number) => void;
    addDialogueClip: (trackId: string, time?: number) => void;
    handleTimelineMouseDown: (e: any, clipId: string, type: 'move' | 'resize') => void;
    selectedClipId: string | null;
    setSelectedClipId: (id: string | null) => void;
    timelineRef: React.RefObject<HTMLDivElement>;
    height: number;
    speakers: Speaker[];
}

export function Timeline({
    tracks,
    clips,
    duration,
    currentTime,
    zoom,
    setZoom,
    setTracks,
    setAddTrackModal,
    handleFileDrop,
    addDialogueClip,
    handleTimelineMouseDown,
    selectedClipId,
    setSelectedClipId,
    timelineRef,
    height,
    speakers
}: TimelineProps) {
    const renderTrackIcon = (type: string) => {
        switch (type) {
            case 'dialogue': return <MessageSquare size={14} className="text-slate-500" />
            case 'audio': return <Music size={14} className="text-slate-500" />
            default: return <Film size={14} className="text-slate-500" />
        }
    };

    const getClipColor = (c: Clip) => {
        if (c.type === 'dialogue') return 'bg-amber-900/80 border-amber-700 text-amber-100';
        else if (c.type === 'audio') return 'bg-emerald-900/80 border-emerald-700 text-emerald-100';
        else if (c.type === 'video' || c.type === 'picture') return 'bg-blue-900/80 border-blue-700 text-blue-100';
        else if (EFFECTS[c.type]) return 'bg-purple-900/80 border-purple-700 text-purple-100';
        return 'bg-slate-700 border-slate-600';
    };

    return (
        <div className="bg-[#0c0c0e] border-t border-slate-800 flex flex-col relative" ref={timelineRef} style={{ height, minHeight: '150px', maxHeight: '80vh' }}>
            {/* TOOLBAR */}
            <div className="h-10 bg-[#121214] border-b border-slate-800 flex items-center px-4 gap-4 shrink-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timeline</span>
                <div className="h-4 w-px bg-slate-700"></div>
                <button
                    onClick={() => setAddTrackModal(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded transition-colors"
                >
                    <Plus size={14} /> Add Track
                </button>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                    <ZoomIn size={14} className="text-slate-500" />
                    <input type="range" min="0.5" max="5" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden timeline-scroll-container">
                {/* TRACK HEADERS */}
                <div className="w-48 flex-shrink-0 bg-[#121214] border-r border-slate-800 overflow-y-auto custom-scrollbar z-10 shadow-lg">
                    {tracks.map(t => (
                        <div key={t.id} className="h-28 border-b border-slate-800 p-3 flex flex-col justify-between group relative transition-colors hover:bg-slate-800/30">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 text-slate-300 font-medium text-xs">
                                        {renderTrackIcon(t.type)}
                                        {t.name}
                                    </div>
                                    <button
                                        onClick={() => setTracks(tracks.map(x => x.id === t.id ? { ...x, mute: !x.mute } : x))}
                                        className={t.mute ? "text-red-500" : "text-slate-600 hover:text-white"}
                                    >
                                        {t.mute ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                    </button>
                                </div>
                                <div className="text-[10px] text-slate-600">{t.type.toUpperCase()}</div>
                            </div>

                            {t.type === 'dialogue' ? (
                                <button
                                    onClick={() => addDialogueClip(t.id)}
                                    className="w-full h-8 border border-dashed border-amber-700/50 rounded flex items-center justify-center text-[10px] text-amber-500 hover:border-amber-500 hover:text-amber-400 hover:bg-amber-900/20 transition-colors cursor-pointer bg-slate-900/50"
                                >
                                    <Plus size={12} className="mr-1" />
                                    Add Dialogue
                                </button>
                            ) : (
                                <div className="relative h-8 border border-dashed border-slate-700 rounded flex items-center justify-center text-[10px] text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer bg-slate-900/50">
                                    <span>Drop File</span>
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileDrop(e, t.id)} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* TIMELINE GRID */}
                <div className="flex-1 bg-[#09090b] overflow-x-auto overflow-y-auto relative timeline-grid"
                    style={{ backgroundSize: `${50 * zoom}px 100%`, backgroundImage: 'linear-gradient(to right, #27272a 1px, transparent 1px)' }}>

                    {/* Playhead */}
                    <div className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none" style={{ left: `${(currentTime / duration) * 100}%` }}>
                        <div className="w-2.5 h-2.5 -ml-[5px] bg-red-500 rounded-full shadow-lg shadow-red-900/50"></div>
                    </div>

                    <div style={{ minWidth: `${duration * 50 * zoom}px`, height: '100%' }} className="relative">
                        {/* Time Markers */}
                        <div className="h-6 border-b border-slate-800 flex text-[10px] text-slate-600 select-none">
                            {Array.from({ length: duration + 1 }).map((_, i) => (
                                <div key={i} style={{ width: `${50 * zoom}px` }} className="border-l border-slate-800/50 pl-1">{i}s</div>
                            ))}
                        </div>

                        {tracks.map(t => (
                            <div key={t.id}
                                className="h-28 border-b border-slate-800/50 relative group hover:bg-white/5 transition-colors"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleFileDrop(e, t.id, (e.nativeEvent.offsetX / (50 * zoom)))}
                            >
                                {clips.filter(c => c.trackId === t.id).map(c => {
                                    const left = (c.start / duration) * 100;
                                    const width = (c.duration / duration) * 100;
                                    const isSelected = selectedClipId === c.id;
                                    const colorClass = getClipColor(c);

                                    const speaker = speakers.find(s => s.id === c.speaker);

                                    return (
                                        <div key={c.id}
                                            className={`absolute top-3 bottom-3 rounded-md border text-xs px-2 py-1 overflow-hidden cursor-pointer select-none shadow-md ${colorClass} ${isSelected ? 'ring-2 ring-white z-20 shadow-xl' : 'z-10 opacity-90 hover:opacity-100'}`}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            onMouseDown={(e) => handleTimelineMouseDown(e, c.id, 'move')}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedClipId(c.id);
                                            }}
                                        >
                                            <div className="truncate font-bold text-[10px] uppercase tracking-wider mb-0.5 opacity-70">
                                                {c.type === 'dialogue' && speaker && (
                                                    <span className="mr-1" style={{ color: speaker.color }}>●</span>
                                                )}
                                                {c.name}
                                                {c.isStale && <span className="ml-1 text-red-400">⚠</span>}
                                            </div>
                                            {c.type === 'dialogue' && <div className="truncate text-[11px] font-serif italic opacity-90">"{c.content || c.scriptText || ''}"</div>}

                                            {/* Handles */}
                                            <div
                                                className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-white/30 z-30 transition-colors"
                                                onMouseDown={(e) => { e.stopPropagation(); handleTimelineMouseDown(e, c.id, 'resize') }}
                                            ></div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
