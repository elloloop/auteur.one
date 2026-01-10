import { Clip } from "@/lib/types";
import { EFFECTS } from "@/lib/effects";
import { Scissors, Sliders, Maximize, Mic, Upload, MousePointer2 } from "lucide-react";
import { useRef, useState } from "react";

interface PropertiesPanelProps {
    selectedClip: Clip | undefined;
    updateClip: (id: string, field: keyof Clip, value: any) => void;
    updateClipParam: (id: string, param: string, value: any) => void;
    splitClip: () => void;
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    handleFileDrop: (e: any, trackId: string) => void; // Using any for React events for now to save type complexity
}

export function PropertiesPanel({
    selectedClip,
    updateClip,
    updateClipParam,
    splitClip,
    isRecording,
    startRecording,
    stopRecording,
    handleFileDrop
}: PropertiesPanelProps) {

    if (!selectedClip) {
        return (
            <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col items-center justify-center text-slate-600 space-y-4 shrink-0">
                <MousePointer2 size={32} className="opacity-20" />
                <p className="text-sm font-medium">Select a clip to edit</p>
            </div>
        );
    }

    return (
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto custom-scrollbar z-10 shadow-xl shrink-0 text-slate-200">
            <div className="p-5 space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clip Properties</h3>
                    <button onClick={splitClip} className="text-indigo-400 hover:text-white" title="Split Clip">
                        <Scissors size={16} />
                    </button>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold">Name</label>
                    <input
                        type="text"
                        value={selectedClip.name}
                        onChange={e => updateClip(selectedClip.id, 'name', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                </div>

                {/* Audio Mix */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] uppercase text-slate-500 font-bold flex items-center gap-2"><Sliders size={12} /> Audio Mix</h4>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Volume</span><span>{Math.round((selectedClip.params.volume || 1) * 100)}%</span></div>
                            <input type="range" min="0" max="2" step="0.1" value={selectedClip.params.volume || 1} onChange={e => updateClipParam(selectedClip.id, 'volume', Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Pitch</span><span>{selectedClip.params.pitch || 0} semi</span></div>
                            <input type="range" min="-12" max="12" step="1" value={selectedClip.params.pitch || 0} onChange={e => updateClipParam(selectedClip.id, 'pitch', Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Speed</span><span>{selectedClip.params.speed || 1}x</span></div>
                            <input type="range" min="0.5" max="2" step="0.1" value={selectedClip.params.speed || 1} onChange={e => updateClipParam(selectedClip.id, 'speed', Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                        </div>
                    </div>
                </div>

                {/* Transform */}
                {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h4 className="text-[10px] uppercase text-slate-500 font-bold flex items-center gap-2"><Maximize size={12} /> Transform</h4>
                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Scale</span><span>{selectedClip.params.scale || 1}x</span></div><input type="range" min="0.1" max="3" step="0.1" value={selectedClip.params.scale !== undefined ? selectedClip.params.scale : 1} onChange={e => updateClipParam(selectedClip.id, 'scale', Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" /></div>
                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Opacity</span><span>{selectedClip.params.opacity !== undefined ? selectedClip.params.opacity : 1}</span></div><input type="range" min="0" max="1" step="0.1" value={selectedClip.params.opacity !== undefined ? selectedClip.params.opacity : 1} onChange={e => updateClipParam(selectedClip.id, 'opacity', Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] text-slate-500 block mb-1">X Position</label><input type="number" value={selectedClip.params.x || 0} onChange={e => updateClipParam(selectedClip.id, 'x', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-xs" /></div>
                            <div><label className="text-[10px] text-slate-500 block mb-1">Y Position</label><input type="number" value={selectedClip.params.y || 0} onChange={e => updateClipParam(selectedClip.id, 'y', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-xs" /></div>
                        </div>
                    </div>
                )}

                {/* Effect Params */}
                {EFFECTS[selectedClip.type] && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h4 className="text-[10px] uppercase text-slate-500 font-bold">Effect Settings</h4>
                        {EFFECTS[selectedClip.type].controls?.map((c: any) => (
                            <div key={c.id}>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>{c.label}</span></div>
                                {c.type === 'range' && <input type="range" min={c.min} max={c.max} step={c.step || 1} value={(selectedClip.params as any)[c.id]} onChange={e => updateClipParam(selectedClip.id, c.id, Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />}
                                {c.type === 'color' && <div className="flex gap-2"><input type="color" value={(selectedClip.params as any)[c.id]} onChange={e => updateClipParam(selectedClip.id, c.id, e.target.value)} className="h-6 w-6 rounded cursor-pointer border-none" /><span className="text-xs text-slate-500 self-center">{(selectedClip.params as any)[c.id]}</span></div>}
                                {c.type === 'checkbox' && <input type="checkbox" checked={(selectedClip.params as any)[c.id]} onChange={e => updateClipParam(selectedClip.id, c.id, e.target.checked)} className="w-4 h-4 rounded bg-slate-700 border-slate-600" />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Dialogue Script */}
                {selectedClip.type === 'dialogue' && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] uppercase text-slate-500 font-bold">Dialogue</h4>
                            <span className="text-[10px] text-amber-500 font-mono bg-amber-900/30 px-2 py-0.5 rounded">{selectedClip.speaker || 'UNKNOWN'}</span>
                        </div>
                        <textarea
                            className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-300 font-serif leading-relaxed resize-none focus:border-indigo-500 focus:outline-none"
                            value={selectedClip.content || ''}
                            onChange={e => updateClip(selectedClip.id, 'content', e.target.value)}
                        />

                        <div className="bg-slate-950 rounded-lg border border-slate-800 p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded text-center cursor-pointer transition-colors border border-slate-700">
                                    <Upload size={12} className="inline mr-1" /> Upload Audio
                                    <input type="file" accept="audio/*" className="hidden" onChange={e => handleFileDrop(e, selectedClip.trackId)} />
                                </label>
                                <button
                                    onClick={isRecording ? () => { stopRecording(); } : () => { startRecording(); }}
                                    className={`flex-1 text-xs py-2 rounded font-bold transition-all flex items-center justify-center gap-1 ${isRecording ? 'bg-red-900/50 text-red-200 border border-red-800 animate-pulse-red' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400' : 'bg-white'}`}></div> {isRecording ? 'Recording...' : 'Record Take'}
                                </button>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                {(selectedClip.takes || []).length === 0 && <div className="text-center text-[10px] text-slate-600 py-2 italic">No takes yet</div>}
                                {(selectedClip.takes || []).map((take, i) => (
                                    <div key={take.id} onClick={() => updateClip(selectedClip.id, 'activeTakeId', take.id)} className={`text-xs p-2 rounded cursor-pointer flex justify-between items-center transition-colors ${selectedClip.activeTakeId === take.id ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                                        <span className="flex items-center gap-2"><Mic size={10} /> Take {i + 1}</span>
                                        <span className="font-mono opacity-50">{take.duration.toFixed(1)}s</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
