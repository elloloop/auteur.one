import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface HeaderProps {
    onExport: () => void;
    isExporting: boolean;
}

export function Header({ onExport, isExporting }: HeaderProps) {
    return (
        <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20 shrink-0">
            <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <span className="font-bold text-lg tracking-tight text-slate-200">Auteur</span>
            </div>
            <div className="flex items-center gap-2">
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
