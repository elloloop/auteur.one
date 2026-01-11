import { Clip, Speaker } from "@/lib/types";
import { EFFECTS } from "@/lib/effects";
import { Scissors, Sliders, Maximize, Mic, Upload, MousePointer2, Trash2, Star } from "lucide-react";
import { useRef, useState } from "react";

interface PropertiesPanelProps {
    selectedClip: Clip | undefined;
    updateClip: (id: string, field: keyof Clip, value: any) => void;
    updateClipParam: (id: string, param: string, value: any) => void;
    splitClip: () => void;
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    uploadTake?: (file: File) => void;
    deleteTake?: (takeId: string) => void;
    speakers: Speaker[];
}

export function PropertiesPanel({
    selectedClip,
    updateClip,
    updateClipParam,
    splitClip,
    isRecording,
    startRecording,
    stopRecording,
    uploadTake,
    deleteTake,
    speakers
}: PropertiesPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadTake) {
            uploadTake(file);
        }
    };

    if (!selectedClip) {
        return (
            <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center text-slate-600 space-y-4">
                <MousePointer2 size={32} className="opacity-20" />
                <p className="text-sm font-medium">Select a clip to edit</p>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-slate-900 flex flex-col overflow-y-auto custom-scrollbar z-10 shadow-xl text-slate-200">
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

                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold">Timing</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] text-slate-600 block mb-1">Start (s)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={selectedClip.start.toFixed(1)}
                                onChange={e => updateClip(selectedClip.id, 'start', Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] text-slate-600 block mb-1">Duration (s)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={selectedClip.duration.toFixed(1)}
                                onChange={e => updateClip(selectedClip.id, 'duration', Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Dialogue Script */}
                {selectedClip.type === 'dialogue' && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] uppercase text-slate-500 font-bold">Dialogue</h4>
                            {selectedClip.isStale && (
                                <span className="text-[9px] text-red-400 bg-red-900/30 px-2 py-0.5 rounded">⚠ Audio Stale</span>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold">Speaker</label>
                            <select
                                value={selectedClip.speaker || ''}
                                onChange={e => updateClip(selectedClip.id, 'speaker', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                            >
                                {speakers.map(speaker => (
                                    <option key={speaker.id} value={speaker.id}>
                                        {speaker.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold">Script</label>
                            <textarea
                                className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-300 font-serif leading-relaxed resize-none focus:border-indigo-500 focus:outline-none"
                                value={selectedClip.content || ''}
                                onChange={e => updateClip(selectedClip.id, 'content', e.target.value)}
                                placeholder="Enter dialogue text..."
                            />
                        </div>

                        <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-3">
                            <div className="flex justify-between items-center">
                                <h5 className="text-[10px] uppercase text-slate-500 font-bold">Takes</h5>
                                <span className="text-[9px] text-slate-600">{selectedClip.takes?.length || 0} recorded</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded text-center cursor-pointer transition-colors border border-slate-700 flex items-center justify-center gap-1"
                                >
                                    <Upload size={12} /> Upload
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`text-xs py-2 rounded font-bold transition-all flex items-center justify-center gap-1 ${
                                        isRecording
                                            ? 'bg-red-900/50 text-red-200 border border-red-800 animate-pulse'
                                            : 'bg-red-600 hover:bg-red-500 text-white'
                                    }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400' : 'bg-white'}`}></div>
                                    {isRecording ? 'Stop' : 'Record'}
                                </button>
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                                {(selectedClip.takes || []).length === 0 && (
                                    <div className="text-center text-[10px] text-slate-600 py-3 italic">No takes yet</div>
                                )}
                                {(selectedClip.takes || []).map((take, i) => (
                                    <div
                                        key={take.id}
                                        className={`text-xs p-2 rounded cursor-pointer flex justify-between items-center transition-colors group ${
                                            selectedClip.activeTakeId === take.id
                                                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                                                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div
                                            className="flex-1 flex items-center gap-2"
                                            onClick={() => updateClip(selectedClip.id, 'activeTakeId', take.id)}
                                        >
                                            <Mic size={10} />
                                            <span className="flex-1">{take.name || `Take ${i + 1}`}</span>
                                            <span className="font-mono opacity-50 text-[10px]">{take.duration.toFixed(1)}s</span>
                                        </div>
                                        {deleteTake && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteTake(take.id);
                                                }}
                                                className="ml-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Audio Mix */}
                {(selectedClip.type === 'audio' || selectedClip.type === 'dialogue' || selectedClip.type === 'video') && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h4 className="text-[10px] uppercase text-slate-500 font-bold flex items-center gap-2">
                            <Sliders size={12} /> Audio Mix
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Volume</span>
                                    <span>{Math.round((selectedClip.params.volume || 1) * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={selectedClip.params.volume || 1}
                                    onChange={e => updateClipParam(selectedClip.id, 'volume', Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Pitch</span>
                                    <span>{selectedClip.params.pitch || 0} semi</span>
                                </div>
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="1"
                                    value={selectedClip.params.pitch || 0}
                                    onChange={e => updateClipParam(selectedClip.id, 'pitch', Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Speed</span>
                                    <span>{selectedClip.params.speed || 1}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={selectedClip.params.speed || 1}
                                    onChange={e => updateClipParam(selectedClip.id, 'speed', Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Transform */}
                {(selectedClip.type === 'video' || selectedClip.type === 'picture' || selectedClip.type === 'text') && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h4 className="text-[10px] uppercase text-slate-500 font-bold flex items-center gap-2">
                            <Maximize size={12} /> Transform
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Scale X</span>
                                    <span>{(selectedClip.params.scaleX || 1).toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="3"
                                    step="0.1"
                                    value={selectedClip.params.scaleX || 1}
                                    onChange={e => updateClipParam(selectedClip.id, 'scaleX', Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Scale Y</span>
                                    <span>{(selectedClip.params.scaleY || 1).toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="3"
                                    step="0.1"
                                    value={selectedClip.params.scaleY || 1}
                                    onChange={e => updateClipParam(selectedClip.id, 'scaleY', Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Opacity</span>
                                    <span>{(selectedClip.params.opacity !== undefined ? selectedClip.params.opacity : 1).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={selectedClip.params.opacity !== undefined ? selectedClip.params.opacity : 1}
                                    onChange={e => updateClipParam(selectedClip.id, 'opacity', Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">X Position</label>
                                    <input
                                        type="number"
                                        value={selectedClip.params.x || 0}
                                        onChange={e => updateClipParam(selectedClip.id, 'x', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">Y Position</label>
                                    <input
                                        type="number"
                                        value={selectedClip.params.y || 0}
                                        onChange={e => updateClipParam(selectedClip.id, 'y', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Effect Params */}
                {EFFECTS[selectedClip.type] && EFFECTS[selectedClip.type].controls && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h4 className="text-[10px] uppercase text-slate-500 font-bold">Effect Settings</h4>
                        {EFFECTS[selectedClip.type].controls?.map((c: any) => (
                            <div key={c.key}>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>{c.label}</span>
                                    {c.type === 'slider' && <span>{selectedClip.params[c.key] || c.default}</span>}
                                </div>
                                {c.type === 'slider' && (
                                    <input
                                        type="range"
                                        min={c.min}
                                        max={c.max}
                                        step={c.step || 1}
                                        value={selectedClip.params[c.key] !== undefined ? selectedClip.params[c.key] : c.default}
                                        onChange={e => updateClipParam(selectedClip.id, c.key, Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                )}
                                {c.type === 'color' && (
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={selectedClip.params[c.key] || c.default}
                                            onChange={e => updateClipParam(selectedClip.id, c.key, e.target.value)}
                                            className="h-6 w-6 rounded cursor-pointer border-none"
                                        />
                                        <span className="text-xs text-slate-500 self-center">{selectedClip.params[c.key] || c.default}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
