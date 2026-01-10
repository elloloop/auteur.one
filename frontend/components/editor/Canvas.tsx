import { Clip, Track } from "@/lib/types";
import { EFFECTS } from "@/lib/effects";
import { SkipBack, Play, Pause } from "lucide-react";
import { useRef, useEffect } from "react";
import { AudioEngine } from "@/lib/audio-engine";

interface CanvasProps {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    setCurrentTime: (time: number) => void;
    currentClips: Clip[];
    currentTracks: Track[];
    audioManager: AudioEngine;
    isExporting: boolean;
    exportProgress: number;
}

export function Canvas({
    canvasRef,
    currentTime,
    duration,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    audioManager,
    isExporting,
    exportProgress
}: CanvasProps) {
    const handleTogglePlay = () => {
        setIsPlaying(!isPlaying);
        if (!isPlaying) {
            audioManager.init();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-black">
            {/* CANVAS CONTAINER */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black">
                <div className="relative border border-slate-800 shadow-2xl bg-black" style={{ aspectRatio: '16/9', maxHeight: '90%', maxWidth: '90%' }}>
                    <canvas
                        ref={canvasRef}
                        width={1920}
                        height={1080}
                        className="w-full h-full object-contain"
                    />
                    {isExporting && (
                        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                            <div className="text-white font-mono text-xl mb-4 animate-pulse">Rendering Video... {Math.round(exportProgress)}%</div>
                            <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-100" style={{ width: `${exportProgress}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* TRANSPORT CONTROLS */}
                <div className="absolute bottom-6 flex items-center space-x-6 bg-slate-900/90 backdrop-blur px-6 py-3 rounded-full border border-slate-700/50 shadow-2xl z-40">
                    <button onClick={() => setCurrentTime(0)} className="text-slate-400 hover:text-white transition-colors">
                        <SkipBack size={20} />
                    </button>
                    <button
                        onClick={handleTogglePlay}
                        className="bg-white text-black p-3 rounded-full hover:scale-105 transition-transform"
                    >
                        {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
                    </button>
                    <div className="font-mono text-sm text-indigo-300 w-32 text-center">
                        {currentTime.toFixed(1)}s <span className="text-slate-600">/</span> {duration}s
                    </div>
                </div>
            </div>
        </div>
    );
}
