import React, { useEffect, useState } from 'react';
import { Upload, X, Search, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/mediaRegistry';
import { MediaAsset } from '../../types';
import { useStore } from '../../context/StoreContext';

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, altText?: string) => void;
  defaultFolder?: string;
  title?: string;
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  defaultFolder = 'products',
  title = 'انتخاب یا آپلود تصویر از کتابخانه رسانه',
}: MediaPickerModalProps) {
  const { notify } = useStore();
  const [uploaded, setUploaded] = useState<MediaAsset[]>([]);
  const [builtins, setBuiltins] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'all' | 'uploaded' | 'builtin'>('all');
  const [search, setSearch] = useState('');
  const [altInput, setAltInput] = useState('');
  const [folder, setFolder] = useState(defaultFolder);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ uploaded: MediaAsset[]; builtins: MediaAsset[] }>('/api/admin/media');
      setUploaded(res.uploaded || []);
      setBuiltins(res.builtins || []);
    } catch (err: any) {
      notify(err.message || 'خطا در بارگذاری کتابخانه رسانه', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadMedia();
    }
  }, [open]);

  if (!open) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      formData.append('folder', folder);
      if (altInput.trim()) formData.append('alt_text', altInput.trim());

      const res = await apiFetch<{ assets: MediaAsset[] }>('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      notify(`${res.assets.length} تصویر با موفقیت آپلود شد`);
      await loadMedia();

      // If single file uploaded, allow quick immediate use or highlight it
      if (res.assets.length === 1) {
        onSelect(res.assets[0].url, res.assets[0].alt_text);
        onClose();
      }
    } catch (err: any) {
      notify(err.message || 'خطا در آپلود تصویر', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const combined =
    tab === 'uploaded'
      ? uploaded
      : tab === 'builtin'
      ? builtins
      : [...uploaded, ...builtins];

  const filtered = combined.filter((m) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return `${m.original_name} ${m.alt_text} ${m.filename} ${m.folder}`.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-4xl rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#111111] text-white flex items-center justify-between gap-4 border-b-2 border-[#B11116]">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-[#B11116]" />
            <h2 className="text-sm sm:text-base font-extrabold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="p-4 sm:p-5 bg-[#FAFAFA] border-b border-[#E5E5E5] space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={altInput}
              onChange={(e) => setAltInput(e.target.value)}
              placeholder="متن جایگزین سئو (ALT) برای تصویر جدید (اختیاری)..."
              className="flex-1 min-w-[200px] min-h-[42px] px-3.5 py-2 text-xs bg-white border border-[#E5E5E5] rounded-xl focus:border-[#111111] focus:outline-none"
            />
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="min-h-[42px] px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-xl font-semibold"
            >
              <option value="products">پوشه محصولات</option>
              <option value="banners">پوشه بنرها</option>
              <option value="categories">پوشه دسته‌بندی‌ها</option>
              <option value="blog">پوشه آکادمی</option>
            </select>
            <label className="min-h-[42px] px-5 py-2.5 bg-[#B11116] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'در حال آپلود...' : 'آپلود تصویر جدید (JPG / PNG / WebP)'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                multiple
                disabled={uploading}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-[#F0F0F0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: `همه (${uploaded.length + builtins.length})` },
              { id: 'uploaded', label: `تصاویر آپلودشده (${uploaded.length})` },
              { id: 'builtin', label: `گالری پایه فروشگاه (${builtins.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#B11116]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در نام یا ALT تصویر..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none"
            />
            <Search className="w-4 h-4 text-[#525252] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-[4/3] bg-[#E5E5E5] rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#525252]">
              تصویری مطابق فیلتر یافت نشد. می‌توانید یک تصویر جدید آپلود کنید.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map((item) => (
                <button
                  key={`${item.source}-${item.id}`}
                  type="button"
                  onClick={() => {
                    onSelect(item.url, item.alt_text);
                    onClose();
                  }}
                  className="group bg-white border border-[#E5E5E5] hover:border-[#B11116] rounded-xl overflow-hidden text-right transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] w-full bg-[#F5F5F5] relative overflow-hidden">
                    <img
                      src={resolveMediaUrl(item.url)}
                      alt={item.alt_text || item.original_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>انتخاب تصویر</span>
                    </span>
                  </div>
                  <div className="p-2.5 space-y-0.5 w-full">
                    <div className="text-xs font-bold text-[#111111] truncate">
                      {item.alt_text || item.original_name}
                    </div>
                    <div className="text-[11px] text-[#525252] truncate">
                      {item.source === 'uploaded' ? 'آپلود اختصاصی' : 'گالری آماده'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
