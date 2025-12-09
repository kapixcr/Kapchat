import React, { useState, useEffect, useRef } from 'react';
import { Smile, X, Upload, Plus } from 'lucide-react';
import { useStickersStore } from '../store/stickersStore';
import { Button } from './Button';
import { Modal } from './Modal';

interface StickerPickerProps {
  onStickerSelect: (stickerUrl: string) => void;
}

export function StickerPickerButton({ onStickerSelect }: StickerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('general');
  const { stickers, fetchStickers, uploadSticker, isLoading } = useStickersStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchStickers();
    }
  }, [isOpen, fetchStickers]);

  const handleStickerClick = (stickerUrl: string) => {
    onStickerSelect(stickerUrl);
    setIsOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen');
        return;
      }
      setUploadFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, '')); // Nombre sin extensión
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      await uploadSticker(uploadFile, uploadName.trim(), uploadCategory);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadName('');
      setUploadCategory('general');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchStickers();
    } catch (error: any) {
      alert(`Error al subir sticker: ${error.message}`);
    }
  };

  // Agrupar stickers por categoría
  const stickersByCategory = stickers.reduce((acc, sticker) => {
    if (!acc[sticker.category]) {
      acc[sticker.category] = [];
    }
    acc[sticker.category].push(sticker);
    return acc;
  }, {} as Record<string, typeof stickers>);

  return (
    <>
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          icon={<Smile size={18} />}
          className="text-zinc-400 hover:text-zinc-200"
        />
        
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute bottom-full left-0 mb-2 w-80 h-96 bg-kap-surface border border-kap-border rounded-xl shadow-2xl z-50 flex flex-col">
              {/* Header */}
              <div className="p-3 border-b border-kap-border flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-200">Stickers</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="p-1.5 rounded-lg hover:bg-kap-surface-light transition-colors"
                    title="Subir sticker"
                  >
                    <Plus size={16} className="text-zinc-400" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-kap-surface-light transition-colors"
                  >
                    <X size={16} className="text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Stickers Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-zinc-500">Cargando stickers...</p>
                  </div>
                ) : stickers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Smile size={48} className="text-zinc-600 mb-3" />
                    <p className="text-sm text-zinc-500 mb-2">No hay stickers disponibles</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-kap-accent hover:underline"
                    >
                      Sube el primero
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(stickersByCategory).map(([category, categoryStickers]) => (
                      <div key={category}>
                        <h4 className="text-xs font-medium text-zinc-500 mb-2 uppercase">
                          {category}
                        </h4>
                        <div className="grid grid-cols-4 gap-2">
                          {categoryStickers.map((sticker) => (
                            <button
                              key={sticker.id}
                              onClick={() => handleStickerClick(sticker.file_url)}
                              className="aspect-square rounded-lg overflow-hidden hover:bg-kap-surface-light transition-colors p-1"
                              title={sticker.name}
                            >
                              <img
                                src={sticker.file_url}
                                alt={sticker.name}
                                className="w-full h-full object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadName('');
          setUploadCategory('general');
        }}
        title="Subir Sticker"
      >
        <div className="space-y-4">
          {uploadFile && (
            <div className="flex items-center justify-center p-4 bg-kap-surface-light rounded-lg">
              <img
                src={URL.createObjectURL(uploadFile)}
                alt="Preview"
                className="max-w-32 max-h-32 object-contain"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Nombre del sticker
            </label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Mi sticker"
              className="w-full px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-kap-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Categoría
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-zinc-200 focus:outline-none focus:border-kap-accent"
            >
              <option value="general">General</option>
              <option value="emotions">Emociones</option>
              <option value="animals">Animales</option>
              <option value="food">Comida</option>
              <option value="objects">Objetos</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
                setUploadName('');
                setUploadCategory('general');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !uploadName.trim() || isLoading}
            >
              {isLoading ? 'Subiendo...' : 'Subir'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

