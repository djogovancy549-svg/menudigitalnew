import React, { useState } from 'react';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';
import { MenuItem } from '../types';

interface AddMenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<MenuItem, 'id'>) => Promise<void>;
}

interface CustomOption {
  name: string;
  choicesString: string;
  required: boolean;
}

const CATEGORY_LABELS = {
  makanan: 'Makanan',
  minuman: 'Minuman',
  cemilan: 'Cemilan/Snack',
  paket: 'Paket Hemat'
};

const SUGGESTED_IMAGES = {
  makanan: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
  minuman: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  cemilan: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=80',
  paket: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'
};

export const AddMenuItemModal: React.FC<AddMenuItemModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuItem['category']>('makanan');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [tags, setTags] = useState('');
  const [options, setOptions] = useState<CustomOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddOptionField = () => {
    setOptions([...options, { name: '', choicesString: '', required: false }]);
  };

  const handleRemoveOptionField = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: keyof CustomOption, value: any) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: value };
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!name.trim()) {
      setError('Nama menu wajib diisi.');
      setIsSubmitting(false);
      return;
    }
    if (!description.trim()) {
      setError('Deskripsi menu wajib diisi.');
      setIsSubmitting(false);
      return;
    }
    const parsedPrice = parseInt(price, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Harga menu harus berupa angka positif.');
      setIsSubmitting(false);
      return;
    }

    // Auto image selection if empty
    const finalImage = image.trim() || SUGGESTED_IMAGES[category];

    const finalTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Process custom options
    const finalOptions = options
      .filter(opt => opt.name.trim() && opt.choicesString.trim())
      .map(opt => ({
        name: opt.name.trim(),
        choices: opt.choicesString.split(',').map(c => c.trim()).filter(Boolean),
        required: opt.required
      }));

    try {
      await onAdd({
        name: name.trim(),
        category,
        description: description.trim(),
        price: parsedPrice,
        image: finalImage,
        tags: finalTags,
        options: finalOptions.length > 0 ? finalOptions : undefined
      });

      // Reset form
      setName('');
      setCategory('makanan');
      setDescription('');
      setPrice('');
      setImage('');
      setTags('');
      setOptions([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan menu ke Google Sheets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="add-menu-modal" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 pb-20 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-stone-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-lg text-stone-800">Tambah Menu Baru</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-r-lg text-sm">
              {error}
            </div>
          )}

          {/* Grid fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                Nama Menu *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="cth: Nasi Goreng Gila"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                Kategori *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MenuItem['category'])}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800 bg-white"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                Harga (Rupiah) *
              </label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="cth: 25000"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                Tags (Pisahkan dengan koma)
              </label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="cth: Pedas, Favorit, Best Seller"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
              Deskripsi Singkat *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Deskripsi bahan-bahan, level kepedasan, atau cara saji..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800 h-20 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
              URL Gambar (Opsional, akan memakai default jika kosong)
            </label>
            <input
              type="url"
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="https://example.com/gambar.jpg"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800"
            />
          </div>

          {/* Custom Options / Opsi Kustom */}
          <div className="border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-stone-700 text-sm">Opsi Kustom (cth: Level Pedas, Es)</h4>
              <button
                type="button"
                onClick={handleAddOptionField}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Opsi
              </button>
            </div>

            {options.length === 0 ? (
              <p className="text-stone-400 text-xs text-center py-4 border border-dashed border-stone-200 rounded-xl">
                Belum ada opsi kustom. Pelanggan akan langsung memesan tanpa pilihan modifikasi.
              </p>
            ) : (
              <div className="space-y-3">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <input
                          type="text"
                          value={opt.name}
                          onChange={e => handleOptionChange(idx, 'name', e.target.value)}
                          placeholder="Nama Opsi (cth: Level Pedas)"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-none text-stone-800 bg-white"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={opt.choicesString}
                          onChange={e => handleOptionChange(idx, 'choicesString', e.target.value)}
                          placeholder="Pilihan (cth: Pedas, Sedang)"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-none text-stone-800 bg-white"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          id={`req-${idx}`}
                          checked={opt.required}
                          onChange={e => handleOptionChange(idx, 'required', e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                        />
                        <label htmlFor={`req-${idx}`} className="text-xs text-stone-500 font-medium">
                          Wajib dipilih oleh pelanggan
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveOptionField(idx)}
                      className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-lg transition-colors mt-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-200 font-medium text-sm transition-colors"
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-all shadow-md shadow-amber-500/10 flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              'Simpan Menu'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
