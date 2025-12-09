import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Smile } from 'lucide-react';

interface EmojiPickerButtonProps {
  onEmojiClick: (emoji: string) => void;
  className?: string;
}

export function EmojiPickerButton({ onEmojiClick, className = '' }: EmojiPickerButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        buttonRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiClick(emojiData.emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={`
          p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-kap-surface-light
          transition-colors focus:outline-none focus:ring-2 focus:ring-kap-accent focus:ring-offset-2 focus:ring-offset-kap-darker
          ${className}
        `}
        title="Agregar emoji"
      >
        <Smile size={20} />
      </button>
      
      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full right-0 mb-2 z-50"
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="dark"
            width={350}
            height={400}
            previewConfig={{
              showPreview: false
            }}
            searchDisabled={false}
            skinTonesDisabled={false}
          />
        </div>
      )}
    </div>
  );
}

