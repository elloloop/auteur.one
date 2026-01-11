import { Download, ArrowLeft, Users, Shuffle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Speaker } from "@/lib/types";

interface HeaderProps {
    onExport: () => void;
    isExporting: boolean;
    rippleMode: boolean;
    setRippleMode: (mode: boolean) => void;
    speakers: Speaker[];
    addSpeaker: () => void;
}

export function Header({ onExport, isExporting, rippleMode, setRippleMode, speakers, addSpeaker }: HeaderProps) {
    const [showSpeakersMenu, setShowSpeakersMenu] = useState(false);

    return (
        <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20 shrink-0">
            <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <span className="font-bold text-lg tracking-tight text-slate-200">Auteur</span>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => setRippleMode(!rippleMode)}
                    className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-2 ${
                        rippleMode
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title="Ripple editing: shift downstream clips when moving/resizing"
                >
                    <Shuffle size={14} />
                    Ripple {rippleMode ? 'ON' : 'OFF'}
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowSpeakersMenu(!showSpeakersMenu)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-all flex items-center gap-2"
                    >
                        <Users size={14} />
                        Speakers ({speakers.length})
                    </button>

                    {showSpeakersMenu && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 space-y-2 z-50">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-[10px] uppercase text-slate-500 font-bold">Speakers</h4>
                                <button
                                    onClick={addSpeaker}
                                    className="text-xs text-indigo-400 hover:text-indigo-300"
                                >
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                {speakers.map(speaker => (
                                    <div
                                        key={speaker.id}
                                        className="flex items-center gap-2 p-2 bg-slate-800/50 rounded text-xs"
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: speaker.color }}
                                        ></div>
                                        <span className="flex-1">{speaker.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={onExport}
                    disabled={isExporting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-lg transition-all flex items-center gap-2"
                >
                    <Download size={14} />
                    {isExporting ? 'Exporting...' : 'Export Video'}
                </button>
            </div>
        </div>
    );
}
