import React, { useEffect, useMemo, useRef } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Editor simple basado en contentEditable con toolbar mínima
export function RichTextEditor({ value, onChange, placeholder, className = '' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isEmpty = useMemo(() => {
    if (!value) return true;
    const text = value
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    return text.length === 0;
  }, [value]);

  // Sincronizar cambios externos (ej. limpiar después de enviar)
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const applyTag = (tag: 'b' | 'u' | 'code') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const wrapper = document.createElement(tag);
    wrapper.textContent = range.toString();
    range.deleteContents();
    range.insertNode(wrapper);

    // Recolocar el cursor después del nodo insertado
    range.setStartAfter(wrapper);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    handleInput(); // Notificar cambio
  };

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
  };

  return (
    <div className={`w-full bg-kap-surface-light border border-kap-border rounded-xl ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-kap-border/60 text-sm text-zinc-300">
        <button
          type="button"
          onClick={() => applyTag('b')}
          className="px-2 py-1 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-kap-accent"
          title="Negrita"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyTag('u')}
          className="px-2 py-1 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-kap-accent"
          title="Subrayado"
        >
          U
        </button>
        <button
          type="button"
          onClick={() => applyTag('code')}
          className="px-2 py-1 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-kap-accent"
          title="Código"
        >
          {'</>'}
        </button>
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute inset-0 px-4 py-3 text-sm text-zinc-500 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="min-h-[80px] max-h-48 overflow-y-auto px-4 py-3 text-sm text-zinc-200 focus:outline-none rounded-b-xl whitespace-pre-wrap"
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}

