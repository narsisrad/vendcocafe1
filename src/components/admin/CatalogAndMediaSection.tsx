import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Download,
  Upload,
  Image as ImageIcon,
  FolderTree,
  Boxes,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  apiFetch,
  downloadAuthenticatedFile,
  formatPersianDate,
  formatToman,
  generateSlug,
  toPersianDigits,
} from '../../lib/format';
import { resolveMediaUrl } from '../../lib/mediaRegistry';
import { Brand, Category, MediaAsset, Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { ProductEditorModal } from './ProductEditorModal';
import { MediaPickerModal } from './MediaPickerModal';

interface CatalogAndMediaSectionProps {
  mode: 'products' | 'media' | 'categories' | 'inventory';
  products: Product[];
  categories: Category[];
  brands: Brand[];
  onRefreshAll: () => void;
  openNewProductTrigger?: number;
}

export function CatalogAndMediaSection({
  mode,
  products,
  categories,
  brands,
  onRefreshAll,
  openNewProductTrigger = 0,
}: CatalogAndMediaSectionProps) {
  const { notify } = useStore();

  // Products state
  const [prodSearch, setProdSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProdId, setExpandedProdId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ product: Product; hasOrders: boolean; orderCount?: number } | null>(null);

  // Media Library state
  const [uploadedMedia, setUploadedMedia] = useState<MediaAsset[]>([]);
  const [builtinMedia, setBuiltinMedia] = useState<MediaAsset[]>([]);
  const [mediaFolder, setMediaFolder] = useState('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [editingAltId, setEditingAltId] = useState<number | null>(null);
  const [altDraft, setAltDraft] = useState('');

  // Categories & Brands state
  const [catBrandTab, setCatBrandTab] = useState<'categories' | 'brands'>('categories');
  const [catForm, setCatForm] = useState({ id: 0, name: '', slug: '', parent_id: '', description: '', image_key: 'prod_arabica_beans', display_order: 0 });
  const [catImagePickerOpen, setCatImagePickerOpen] = useState(false);
  const [brandForm, setBrandForm] = useState({ id: 0, name: '', slug: '', country: '', description: '' });

  // Inventory Movements state
  const [movements, setMovements] = useState<any[]>([]);
  const [invVariantId, setInvVariantId] = useState<number>(0);
  const [invType, setInvType] = useState('purchase_receipt');
  const [invQty, setInvQty] = useState(10);
  const [invReason, setInvReason] = useState('');
  const [invWarehouse, setInvWarehouse] = useState('انبار مرکزی تهران');

  useEffect(() => {
    if (openNewProductTrigger > 0) {
      setEditingProduct(null);
      setEditorOpen(true);
    }
  }, [openNewProductTrigger]);

  const loadMedia = async () => {
    try {
      const res = await apiFetch<{ uploaded: MediaAsset[]; builtins: MediaAsset[] }>('/api/admin/media');
      setUploadedMedia(res.uploaded || []);
      setBuiltinMedia(res.builtins || []);
    } catch {
      // ignore
    }
  };

  const loadMovements = async () => {
    try {
      const res = await apiFetch<{ movements: any[] }>('/api/admin/inventory/movements?limit=100');
      setMovements(res.movements || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (mode === 'media') loadMedia();
    if (mode === 'inventory') {
      loadMovements();
      const firstVariant = products[0]?.variants?.[0]?.id;
      if (firstVariant && !invVariantId) setInvVariantId(firstVariant);
    }
  }, [mode, products.length]);

  const allVariants = useMemo(() => {
    const list: Array<{ id: number; label: string; stock: number; sku: string }> = [];
    for (const p of products) {
      for (const v of p.variants || []) {
        list.push({
          id: v.id,
          label: `${p.title} — ${v.variant_title} (${v.sku}) [موجودی: ${toPersianDigits(v.stock_quantity)}]`,
          stock: v.stock_quantity,
          sku: v.sku,
        });
      }
    }
    return list;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (prodSearch.trim()) {
        const q = prodSearch.trim().toLowerCase();
        const hay = `${p.title} ${p.sku} ${p.slug} ${p.category_name || ''} ${p.brand_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (catFilter && String(p.category_id) !== catFilter) return false;
      const totalStock = p.total_available_stock ?? (p.variants || []).reduce((s, v) => s + Math.max(0, v.stock_quantity - v.reserved_quantity), 0);
      if (stockFilter === 'out' && totalStock > 0) return false;
      if (stockFilter === 'low' && (totalStock <= 0 || totalStock > 10)) return false;
      if (stockFilter === 'in' && totalStock <= 10) return false;
      return true;
    });
  }, [products, prodSearch, catFilter, stockFilter]);

  const handleDeleteProduct = async (product: Product, archive = false) => {
    try {
      const res = await apiFetch<{ ok: boolean; archived?: boolean }>(
        `/api/admin/products/${product.id}${archive ? '?archive=1' : ''}`,
        { method: 'DELETE' }
      );
      notify(res.archived ? 'محصول به صورت امن آرشیو و از فروشگاه مخفی شد.' : 'محصول با موفقیت حذف شد.');
      setDeleteTarget(null);
      onRefreshAll();
    } catch (err: any) {
      if (err.message?.includes('سفارش') || err.message?.includes('آرشیو')) {
        setDeleteTarget({ product, hasOrders: true });
      } else {
        notify(err.message || 'خطا در حذف محصول', 'error');
      }
    }
  };

  // ========================
  // MODE 1: PRODUCTS
  // ========================
  if (mode === 'products') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#111111]">مدیریت جامع محصولات، تصاویر و قیمت عمده</h1>
            <p className="text-xs text-[#525252] mt-1">
              افزودن کالا، تغییر عکس اصلی و گالری، ویرایش تنوع‌ها و قیمت همکار عمده یا حذف امن محصول
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => downloadAuthenticatedFile('/api/admin/export/products', 'baristapro-products.csv').catch((e) => notify(e.message, 'error'))}
              className="min-h-[44px] px-4 py-2 border border-[#E5E5E5] bg-white text-[#111111] text-xs font-bold rounded-xl hover:border-[#111111] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>خروجی CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setEditorOpen(true);
              }}
              className="min-h-[44px] px-5 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن محصول جدید</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="relative sm:col-span-2">
            <input
              type="search"
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
              placeholder="جستجوی نام محصول، کد SKU، برند یا اسلاگ..."
              className="w-full pr-9 pl-3 py-2.5 bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none"
            />
            <Search className="w-4 h-4 text-[#525252] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
          >
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
          >
            <option value="">همه وضعیت‌های موجودی</option>
            <option value="in">موجود (بالای ۱۰ عدد)</option>
            <option value="low">موجودی کم (۱ تا ۱۰)</option>
            <option value="out">ناموجود</option>
          </select>
        </div>

        {/* Product List */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm font-bold text-[#111111]">محصولی مطابق فیلتر انتخابی یافت نشد.</p>
            <button
              type="button"
              onClick={() => {
                setProdSearch('');
                setCatFilter('');
                setStockFilter('');
              }}
              className="min-h-[42px] px-5 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              نمایش همه محصولات
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              const firstVar = p.variants?.[0];
              const totalStock = p.total_available_stock ?? (p.variants || []).reduce((s, v) => s + Math.max(0, v.stock_quantity - v.reserved_quantity), 0);
              const isExpanded = expandedProdId === p.id;
              return (
                <div key={p.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Thumbnail & Core Meta */}
                    <div className="flex items-start gap-4 min-w-0">
                      <img
                        src={resolveMediaUrl(p.main_image)}
                        alt={p.title}
                        className="w-20 h-16 rounded-xl object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm font-extrabold text-[#111111]">{p.title}</strong>
                          {!p.is_published && (
                            <span className="text-[11px] font-bold text-[#B11116]">[پیش‌نویس / آرشیو]</span>
                          )}
                        </div>
                        <div className="text-xs text-[#525252] flex flex-wrap items-center gap-2 tabular-nums">
                          <span>{p.category_name}</span>
                          {p.brand_name && <span>· {p.brand_name}</span>}
                          <span>· SKU: {p.sku}</span>
                          <span>· سئو: {toPersianDigits(p.seo_score ?? 0)} از ۱۰۰</span>
                        </div>
                        <div className="text-xs flex flex-wrap items-center gap-3 tabular-nums">
                          <span className="font-bold text-[#111111]">
                            قیمت: {formatToman(firstVar?.discount_price || firstVar?.regular_price || 0)}
                          </span>
                          {firstVar?.wholesale_price && (
                            <span className="font-bold text-[#B11116]">
                              عمده: {formatToman(firstVar.wholesale_price)}
                            </span>
                          )}
                          <span className={`font-bold ${totalStock <= 0 ? 'text-[#B11116]' : totalStock <= 10 ? 'text-amber-700' : 'text-[#1E6B4B]'}`}>
                            موجودی کل: {toPersianDigits(totalStock)} {p.unit_label_fa}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(p);
                          setEditorOpen(true);
                        }}
                        className="min-h-[40px] px-4 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#B11116] transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش کامل / تغییر عکس</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedProdId(isExpanded ? null : p.id)}
                        className="min-h-[40px] px-3.5 py-2 border border-[#E5E5E5] text-[#111111] text-xs font-bold rounded-xl hover:border-[#111111] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>قیمت و موجودی سریع</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/products/${p.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ is_published: p.is_published ? 0 : 1 }),
                          });
                          notify(p.is_published ? 'محصول به حالت پیش‌نویس رفت' : 'محصول منتشر شد');
                          onRefreshAll();
                        }}
                        className={`min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl border cursor-pointer whitespace-nowrap ${
                          p.is_published
                            ? 'border-emerald-200 bg-emerald-50 text-[#1E6B4B]'
                            : 'border-[#E5E5E5] bg-[#F8F8F8] text-[#525252]'
                        }`}
                      >
                        {p.is_published ? 'منتشرشده' : 'پیش‌نویس'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ product: p, hasOrders: false })}
                        className="min-h-[40px] px-3.5 py-2 border border-[#B11116]/30 text-[#B11116] text-xs font-bold rounded-xl hover:bg-[#B11116] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Inline Variant Stock & Price Editor */}
                  {isExpanded && (
                    <div className="divide-y divide-[#F0F0F0] border border-[#E5E5E5] rounded-xl text-xs bg-[#FAFAFA]">
                      {(p.variants || []).map((v) => (
                        <QuickVariantRow key={v.id} variant={v} onSaved={onRefreshAll} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ProductEditorModal
          open={editorOpen}
          product={editingProduct}
          categories={categories}
          brands={brands}
          allProducts={products}
          onClose={() => setEditorOpen(false)}
          onSaved={onRefreshAll}
        />

        {/* Delete / Safe Archive Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
            <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 border border-[#E5E5E5]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 text-[#B11116]">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold">
                  {deleteTarget.hasOrders ? 'محصول دارای سابقه سفارش است' : 'تایید حذف محصول'}
                </h3>
              </div>
              <p className="text-xs text-[#525252] leading-relaxed">
                {deleteTarget.hasOrders
                  ? `محصول «${deleteTarget.product.title}» در سفارش‌های ثبت‌شده قبلی وجود دارد و جهت حفظ صحت اسناد حسابداری حذف فیزیکی نمی‌شود. آیا مایلید به‌صورت امن آرشیو و از فروشگاه مخفی شود؟`
                  : `آیا از حذف «${deleteTarget.product.title}» اطمینان دارید؟ در صورت نداشتن سفارش قبلی، محصول و تنوع‌های آن برای همیشه حذف می‌شوند.`}
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="min-h-[42px] px-4 py-2 border border-[#E5E5E5] rounded-xl text-xs font-bold text-[#111111] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(deleteTarget.product, deleteTarget.hasOrders)}
                  className="min-h-[42px] px-5 py-2 bg-[#B11116] text-white rounded-xl text-xs font-bold hover:bg-[#111111] cursor-pointer"
                >
                  {deleteTarget.hasOrders ? 'آرشیو و مخفی‌سازی امن' : 'حذف نهایی محصول'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // MODE 2: MEDIA LIBRARY
  // ========================
  if (mode === 'media') {
    const allAssets = [...uploadedMedia, ...builtinMedia].filter((m) => {
      if (mediaFolder !== 'all' && m.folder !== mediaFolder) return false;
      if (mediaSearch.trim()) {
        const q = mediaSearch.trim().toLowerCase();
        if (!`${m.original_name} ${m.alt_text} ${m.filename}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setUploadingMedia(true);
      try {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append('files', f));
        fd.append('folder', mediaFolder === 'all' ? 'products' : mediaFolder);
        const res = await apiFetch<{ assets: MediaAsset[] }>('/api/admin/media/upload', {
          method: 'POST',
          body: fd,
        });
        notify(`${res.assets.length} تصویر با موفقیت به کتابخانه اضافه شد`);
        await loadMedia();
      } catch (err: any) {
        notify(err.message || 'خطا در آپلود فایل', 'error');
      } finally {
        setUploadingMedia(false);
        e.target.value = '';
      }
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#B11116]" />
              <span>کتابخانه رسانه و مدیریت تصاویر فروشگاه</span>
            </h1>
            <p className="text-xs text-[#525252] mt-1">
              آپلود، ویرایش متن ALT سئو و مدیریت تمام تصاویر محصولات، دسته‌ها و بنرهای سایت
            </p>
          </div>
          <label className="min-h-[44px] px-5 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4" />
            <span>{uploadingMedia ? 'در حال آپلود...' : 'آپلود تصاویر جدید'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              multiple
              disabled={uploadingMedia}
              onChange={handleDirectUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'همه پوشه‌ها' },
              { id: 'products', label: 'محصولات' },
              { id: 'banners', label: 'بنرها' },
              { id: 'categories', label: 'دسته‌بندی‌ها' },
              { id: 'blog', label: 'آکادمی' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setMediaFolder(f.id)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg font-bold border cursor-pointer ${
                  mediaFolder === f.id
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-[#525252] border-[#E5E5E5]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="search"
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              placeholder="جستجوی نام یا متن ALT..."
              className="w-full pr-9 pl-3 py-2 bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl"
            />
            <Search className="w-4 h-4 text-[#525252] absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {allAssets.map((m) => (
            <div key={`${m.source}-${m.id}`} className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-[#F5F5F5] relative">
                <img src={resolveMediaUrl(m.url)} alt={m.alt_text} className="w-full h-full object-cover" />
              </div>
              <div className="p-3.5 space-y-2 text-xs flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-[#111111] truncate">{m.original_name}</div>
                  {m.usage && m.usage.length > 0 && (
                    <div className="text-[11px] text-[#1E6B4B] font-semibold truncate">
                      استفاده در {toPersianDigits(m.usage.length)} بخش ({m.usage[0].title})
                    </div>
                  )}
                  {m.source === 'uploaded' && editingAltId === Number(m.id) ? (
                    <div className="flex gap-1 pt-1">
                      <input
                        value={altDraft}
                        onChange={(e) => setAltDraft(e.target.value)}
                        className="flex-1 px-2 py-1 border border-[#111111] rounded text-[11px]"
                        placeholder="متن ALT"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/media/${m.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ alt_text: altDraft }),
                          });
                          setEditingAltId(null);
                          notify('متن ALT ذخیره شد');
                          loadMedia();
                        }}
                        className="px-2 py-1 bg-[#111111] text-white rounded cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#525252] truncate">ALT: {m.alt_text || '—'}</div>
                  )}
                </div>

                {m.source === 'uploaded' ? (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F0F0F0]">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAltId(Number(m.id));
                        setAltDraft(m.alt_text || '');
                      }}
                      className="text-[11px] font-bold text-[#111111] hover:text-[#B11116] cursor-pointer"
                    >
                      ویرایش ALT
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/media/${m.id}`, { method: 'DELETE' });
                          notify('تصویر حذف شد');
                          loadMedia();
                        } catch (err: any) {
                          if (err.message?.includes('استفاده شده')) {
                            await apiFetch(`/api/admin/media/${m.id}?force=1`, { method: 'DELETE' });
                            notify('تصویر با تایید اجباری حذف شد', 'info');
                            loadMedia();
                          } else {
                            notify(err.message, 'error');
                          }
                        }
                      }}
                      className="text-[11px] font-bold text-[#B11116] hover:underline cursor-pointer"
                    >
                      حذف فایل
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8C8C8C] pt-2 border-t border-[#F0F0F0]">فایل پایه سیستم</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ========================
  // MODE 3: CATEGORIES & BRANDS
  // ========================
  if (mode === 'categories') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-[#B11116]" />
              <span>مدیریت دسته‌بندی‌ها و برندهای تامین‌کننده</span>
            </h1>
          </div>
          <div className="inline-flex border border-[#E5E5E5] bg-white rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setCatBrandTab('categories')}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                catBrandTab === 'categories' ? 'bg-[#111111] text-white' : 'text-[#525252]'
              }`}
            >
              دسته‌بندی‌ها ({toPersianDigits(categories.length)})
            </button>
            <button
              type="button"
              onClick={() => setCatBrandTab('brands')}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                catBrandTab === 'brands' ? 'bg-[#111111] text-white' : 'text-[#525252]'
              }`}
            >
              برندها ({toPersianDigits(brands.length)})
            </button>
          </div>
        </div>

        {catBrandTab === 'categories' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (catForm.id) {
                    await apiFetch(`/api/admin/categories/${catForm.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        ...catForm,
                        parent_id: catForm.parent_id ? Number(catForm.parent_id) : null,
                      }),
                    });
                    notify('دسته‌بندی بروزرسانی شد');
                  } else {
                    await apiFetch('/api/admin/categories', {
                      method: 'POST',
                      body: JSON.stringify({
                        ...catForm,
                        parent_id: catForm.parent_id ? Number(catForm.parent_id) : null,
                      }),
                    });
                    notify('دسته‌بندی جدید ایجاد شد');
                  }
                  setCatForm({ id: 0, name: '', slug: '', parent_id: '', description: '', image_key: 'prod_arabica_beans', display_order: 0 });
                  onRefreshAll();
                } catch (err: any) {
                  notify(err.message, 'error');
                }
              }}
              className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3 text-xs"
            >
              <h2 className="text-sm font-extrabold text-[#111111]">
                {catForm.id ? 'ویرایش دسته‌بندی' : 'ایجاد دسته‌بندی جدید'}
              </h2>
              <input
                required
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="نام دسته‌بندی فارسی"
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <div className="flex gap-2">
                <input
                  required
                  dir="ltr"
                  value={catForm.slug}
                  onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                  placeholder="slug-latin"
                  className="flex-1 px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left"
                />
                <button
                  type="button"
                  onClick={() => setCatForm({ ...catForm, slug: generateSlug(catForm.slug || catForm.name) })}
                  className="px-3 border border-[#E5E5E5] rounded-xl font-bold cursor-pointer"
                >
                  اسلاگ
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={catForm.parent_id}
                  onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value })}
                  className="px-3 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                >
                  <option value="">دسته اصلی (بدون والد)</option>
                  {categories
                    .filter((c) => c.id !== catForm.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  value={catForm.display_order}
                  onChange={(e) => setCatForm({ ...catForm, display_order: Number(e.target.value) })}
                  placeholder="ترتیب نمایش"
                  className="px-3 py-2.5 border border-[#E5E5E5] rounded-xl tabular-nums"
                />
              </div>
              <textarea
                rows={2}
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                placeholder="توضیحات دسته‌بندی..."
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <div className="flex items-center gap-3">
                <img
                  src={resolveMediaUrl(catForm.image_key)}
                  alt=""
                  className="w-16 h-12 rounded-lg object-cover border border-[#E5E5E5]"
                />
                <button
                  type="button"
                  onClick={() => setCatImagePickerOpen(true)}
                  className="min-h-[40px] px-4 py-2 border border-[#111111] rounded-xl font-bold hover:bg-[#111111] hover:text-white cursor-pointer"
                >
                  انتخاب / آپلود تصویر دسته
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] cursor-pointer"
                >
                  {catForm.id ? 'ذخیره تغییرات' : 'ایجاد دسته‌بندی'}
                </button>
                {catForm.id > 0 && (
                  <button
                    type="button"
                    onClick={() => setCatForm({ id: 0, name: '', slug: '', parent_id: '', description: '', image_key: 'prod_arabica_beans', display_order: 0 })}
                    className="px-4 border border-[#E5E5E5] rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                )}
              </div>
            </form>

            <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl divide-y divide-[#F0F0F0]">
              {categories.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={resolveMediaUrl(c.image_key)} alt={c.name} className="w-14 h-11 rounded-lg object-cover shrink-0 bg-[#F5F5F5]" />
                    <div className="min-w-0">
                      <div className="font-extrabold text-[#111111] truncate">{c.name}</div>
                      <div className="text-[#525252] tabular-nums" dir="ltr">
                        /category/{c.slug} · {toPersianDigits(c.product_count || 0)} کالا
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCatForm({
                          id: c.id,
                          name: c.name,
                          slug: c.slug,
                          parent_id: c.parent_id ? String(c.parent_id) : '',
                          description: c.description || '',
                          image_key: c.image_key || 'prod_arabica_beans',
                          display_order: c.display_order || 0,
                        })
                      }
                      className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold hover:border-[#111111] cursor-pointer"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
                          notify('دسته‌بندی حذف شد');
                          onRefreshAll();
                        } catch (err: any) {
                          notify(err.message, 'error');
                        }
                      }}
                      className="px-3 py-1.5 border border-[#B11116]/30 text-[#B11116] rounded-lg font-bold hover:bg-[#B11116] hover:text-white cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <MediaPickerModal
              open={catImagePickerOpen}
              onClose={() => setCatImagePickerOpen(false)}
              defaultFolder="categories"
              onSelect={(url) => setCatForm((prev) => ({ ...prev, image_key: url }))}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (brandForm.id) {
                    await apiFetch(`/api/admin/brands/${brandForm.id}`, { method: 'PUT', body: JSON.stringify(brandForm) });
                    notify('برند بروزرسانی شد');
                  } else {
                    await apiFetch('/api/admin/brands', { method: 'POST', body: JSON.stringify(brandForm) });
                    notify('برند جدید ثبت شد');
                  }
                  setBrandForm({ id: 0, name: '', slug: '', country: '', description: '' });
                  onRefreshAll();
                } catch (err: any) {
                  notify(err.message, 'error');
                }
              }}
              className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3 text-xs"
            >
              <h2 className="text-sm font-extrabold text-[#111111]">
                {brandForm.id ? 'ویرایش برند' : 'ثبت برند جدید'}
              </h2>
              <input
                required
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                placeholder="نام برند"
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <input
                required
                dir="ltr"
                value={brandForm.slug}
                onChange={(e) => setBrandForm({ ...brandForm, slug: e.target.value })}
                placeholder="brand-slug"
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left"
              />
              <input
                value={brandForm.country}
                onChange={(e) => setBrandForm({ ...brandForm, country: e.target.value })}
                placeholder="کشور مبدا (مثلاً ایتالیا / ایران)"
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <textarea
                rows={2}
                value={brandForm.description}
                onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                placeholder="معرفی برند..."
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <button type="submit" className="w-full min-h-[44px] bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] cursor-pointer">
                {brandForm.id ? 'بروزرسانی برند' : 'افزودن برند'}
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl divide-y divide-[#F0F0F0]">
              {brands.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-extrabold text-[#111111]">{b.name} {b.country ? `(${b.country})` : ''}</div>
                    <div className="text-[#525252] tabular-nums">{toPersianDigits(b.product_count || 0)} محصول</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBrandForm({ id: b.id, name: b.name, slug: b.slug, country: b.country || '', description: b.description || '' })}
                      className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold cursor-pointer"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/brands/${b.id}`, { method: 'DELETE' });
                        notify('برند حذف شد');
                        onRefreshAll();
                      }}
                      className="px-3 py-1.5 border border-[#B11116]/30 text-[#B11116] rounded-lg font-bold cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // MODE 4: INVENTORY LEDGER & ADJUSTMENT
  // ========================
  const movementTypeLabels: Record<string, string> = {
    purchase_receipt: 'رسید خرید و ورود به انبار',
    manual_increase: 'افزایش دستی موجودی',
    manual_decrease: 'کاهش دستی موجودی',
    damage: 'ضایعات / کسری آسیب‌دیده',
    stock_correction: 'اصلاح انبارگردانی (تنظیم عدد نهایی)',
    customer_return: 'مرجوعی سالم از مشتری',
    order_paid: 'کسر فروش سفارش',
    order_cancelled: 'بازگشت موجودی لغو سفارش',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#B11116]" />
            <span>انبارداری و کاردکس گردش کالا</span>
          </h1>
          <p className="text-xs text-[#525252] mt-1">
            ثبت ورود و خروج انبار با دلیل الزامی و ردیابی کامل تاریخچه تغییرات موجودی
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadAuthenticatedFile('/api/admin/export/inventory', 'baristapro-inventory.csv').catch((e) => notify(e.message, 'error'))}
          className="min-h-[42px] px-4 py-2 border border-[#E5E5E5] bg-white text-xs font-bold rounded-xl hover:border-[#111111] inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>خروجی CSV کاردکس</span>
        </button>
      </div>

      {/* Stock Adjustment Form */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!invVariantId || !invReason.trim()) {
            notify('انتخاب کالا و ذکر دلیل تغییر انبار الزامی است.', 'error');
            return;
          }
          try {
            const res = await apiFetch<{ previous_quantity: number; new_quantity: number }>('/api/admin/inventory/adjust', {
              method: 'POST',
              body: JSON.stringify({
                variant_id: invVariantId,
                movement_type: invType,
                quantity: invQty,
                reason: invReason,
                warehouse_location: invWarehouse,
              }),
            });
            notify(`موجودی با موفقیت از ${toPersianDigits(res.previous_quantity)} به ${toPersianDigits(res.new_quantity)} تغییر یافت`);
            setInvReason('');
            loadMovements();
            onRefreshAll();
          } catch (err: any) {
            notify(err.message, 'error');
          }
        }}
        className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4 text-xs"
      >
        <h2 className="text-sm font-extrabold text-[#111111]">ثبت سند ورود / خروج / انبارگردانی</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={invVariantId}
            onChange={(e) => setInvVariantId(Number(e.target.value))}
            className="sm:col-span-2 px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
          >
            {allVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>

          <select
            value={invType}
            onChange={(e) => setInvType(e.target.value)}
            className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white font-semibold"
          >
            <option value="purchase_receipt">رسید خرید تامین‌کننده (+)</option>
            <option value="manual_increase">افزایش دستی موجودی (+)</option>
            <option value="customer_return">مرجوعی سالم مشتری (+)</option>
            <option value="manual_decrease">کاهش دستی موجودی (-)</option>
            <option value="damage">ضایعات و آسیب فیزیکی (-)</option>
            <option value="stock_correction">تنظیم عدد دقیق انبارگردانی (=)</option>
          </select>

          <input
            type="number"
            required
            min={1}
            value={invQty}
            onChange={(e) => setInvQty(Number(e.target.value))}
            placeholder="تعداد"
            className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl tabular-nums"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={invWarehouse}
            onChange={(e) => setInvWarehouse(e.target.value)}
            placeholder="نام انبار (مثلاً انبار مرکزی تهران)"
            className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
          />
          <input
            type="text"
            required
            value={invReason}
            onChange={(e) => setInvReason(e.target.value)}
            placeholder="دلیل و شماره سند / فاکتور تامین‌کننده (الزامی)..."
            className="sm:col-span-2 px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
          />
        </div>

        <button
          type="submit"
          className="min-h-[44px] px-6 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
        >
          ثبت سند در کاردکس انبار
        </button>
      </form>

      {/* Movements Table */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-[#111111]">تاریخچه گردش کالا و اسناد انبار</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-[#525252]">
                <th className="py-3">کالا / تنوع</th>
                <th className="py-3">نوع حرکت</th>
                <th className="py-3">تغییر</th>
                <th className="py-3">قبلی ← جدید</th>
                <th className="py-3">توضیحات</th>
                <th className="py-3">ثبت‌کننده</th>
                <th className="py-3">تاریخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 font-semibold text-[#111111]">
                    <div>{m.product_title}</div>
                    <div className="text-[11px] text-[#525252] tabular-nums">{m.sku}</div>
                  </td>
                  <td className="py-3">{movementTypeLabels[m.reference_type] || m.reference_type || m.type}</td>
                  <td className={`py-3 font-extrabold tabular-nums ${m.quantity_delta >= 0 ? 'text-[#1E6B4B]' : 'text-[#B11116]'}`} dir="ltr">
                    {m.quantity_delta >= 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                  </td>
                  <td className="py-3 tabular-nums text-[#525252]">
                    {m.previous_quantity != null ? `${toPersianDigits(m.previous_quantity)} ← ${toPersianDigits(m.new_quantity)}` : '—'}
                  </td>
                  <td className="py-3 text-[#525252] max-w-[240px] truncate">{m.note || '—'}</td>
                  <td className="py-3">{m.actor_name || 'سیستم'}</td>
                  <td className="py-3 text-[#8C8C8C] tabular-nums">{formatPersianDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QuickVariantRow({ variant, onSaved }: { variant: any; onSaved: () => void }) {
  const { notify } = useStore();
  const [stock, setStock] = useState(variant.stock_quantity);
  const [price, setPrice] = useState(variant.regular_price);
  const [discount, setDiscount] = useState(variant.discount_price ?? '');

  return (
    <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-[180px]">
        <div className="font-bold text-[#111111]">{variant.variant_title}</div>
        <div className="text-[11px] text-[#525252] tabular-nums">
          SKU: {variant.sku} · رزرو: {toPersianDigits(variant.reserved_quantity)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="text-[11px] font-semibold text-[#525252] inline-flex items-center gap-1.5">
          <span>موجودی:</span>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
            className="w-20 px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-lg tabular-nums text-[#111111]"
          />
        </label>
        <label className="text-[11px] font-semibold text-[#525252] inline-flex items-center gap-1.5">
          <span>قیمت:</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-28 px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-lg tabular-nums text-[#111111]"
          />
        </label>
        <label className="text-[11px] font-semibold text-[#525252] inline-flex items-center gap-1.5">
          <span>تخفیف:</span>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="ندارد"
            className="w-28 px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-lg tabular-nums text-[#111111]"
          />
        </label>
        <button
          type="button"
          onClick={async () => {
            await apiFetch(`/api/admin/variants/${variant.id}/stock`, {
              method: 'PATCH',
              body: JSON.stringify({
                stock_quantity: stock,
                regular_price: price,
                discount_price: discount === '' ? null : Number(discount),
              }),
            });
            notify(`موجودی و قیمت ${variant.sku} ذخیره شد`);
            onSaved();
          }}
          className="min-h-[38px] px-4 py-1.5 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#B11116] transition-colors cursor-pointer whitespace-nowrap"
        >
          ذخیره
        </button>
      </div>
    </div>
  );
}
