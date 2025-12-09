import React from 'react';
import { Minus, Square, X, RefreshCw } from 'lucide-react';

export function TitleBar() {
  return (
    <div className="h-8 bg-kap-darker flex items-center justify-between px-4 titlebar-drag">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-kap-accent to-purple-400 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">K</span>
        </div>
        <span className="text-xs font-display font-semibold text-zinc-400">Kapchat</span>
      </div>
      
      <div className="flex items-center titlebar-no-drag">
        <button
          onClick={() => window.api.window.reload()}
          className="w-10 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          title="Recargar"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={() => window.api.window.minimize()}
          className="w-10 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          title="Minimizar"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.api.window.maximize()}
          className="w-10 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          title="Maximizar"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="w-10 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-500/80 transition-colors"
          title="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

