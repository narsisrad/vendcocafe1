import React, { useEffect, useState } from 'react';
import { X, ImagePlus, Trash2, Plus, Star, Wand2 } from 'lucide-react';
import { apiFetch, generateSlug } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/mediaRegistry';
import { Brand, Category, Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { MediaPickerModal } from './MediaPickerModal';

interface VariantDraft {
  id?: number;
  sku: string;
  barcode: string;
  variant_title: string;
  regular_price: number;
  discount_price: string;
  wholesale_price: string;
  cost_price: string;
  stock_quantity: number;
  min_stock_alert: number;
  warehouse_location: string;
  is_active: boolean;
}

interface ProductEditorModalProps {
  open: boolean;
  product: Product | null;
  categories: Category[];
  brands: Brand[];
  allProducts: Product[];
  onClose: () => void;
  onSaved: () => void;
}

export function ProductEditorModal({
  open,
  product,
  categories,
  brands,
  allProducts,
  onClose,
  onSaved,
}: ProductEditorModalProps) {
  const { notify } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'images' | 'variants' | 'shipping'>('general');
  const [saving, setSaving] = useState(false);

  // Media picker state
  const [pickerTarget, setPickerTarget] = useState<'main' | 'gallery' | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [brandId, setBrandId] = useState<string>('');
  const [manufacturer, setManufacturer] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [specRows, setSpecRows] = useState<Array<{ key: string; value: string }>>([]);

  // Images
  const [mainImage, setMainImage] = useState('prod_arabica_beans');
  const [mainImageAlt, setMainImageAlt] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // Units & Variants
  const [unitType, setUnitType] = useState('pack');
  const [unitLabelFa, setUnitLabelFa] = useState('بسته');
  const [minOrderQty, setMinOrderQty] = useState(1);
  const [orderStepQty, setOrderStepQty] = useState(1);
  const [maxOrderQty, setMaxOrderQty] = useState<string>('');
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  // Shipping & Publish
  const [weightGrams, setWeightGrams] = useState(1000);
  const [shippingClass, setShippingClass] = useState('standard');
  const [isFragile, setIsFragile] = useState(false);
  const [complementaryIds, setComplementaryIds] = useState<number[]>([]);
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    if (!open) return;
    setActiveTab('general');

    if (product) {
      setTitle(product.title || '');
      setSlug(product.slug || '');
      setSku(product.sku || '');
      setCategoryId(product.category_id || categories[0]?.id || 1);
      setBrandId(product.brand_id ? String(product.brand_id) : '');
      setManufacturer(product.manufacturer || '');
      setShortDesc(product.short_description || '');
      setDescription(product.description || '');
      setTagsText((product.tags || []).join('، '));
      setSpecRows(
        Object.entries(product.specifications || {}).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      );
      setMainImage(product.main_image || 'prod_arabica_beans');
      setMainImageAlt(product.main_image_alt || product.title || '');
      setGalleryImages(Array.isArray(product.gallery_images) ? product.gallery_images : []);
      setUnitType(product.unit_type || 'pack');
      setUnitLabelFa(product.unit_label_fa || 'بسته');
      setMinOrderQty(product.min_order_qty || 1);
      setOrderStepQty(product.order_step_qty || 1);
      setMaxOrderQty(product.max_order_qty ? String(product.max_order_qty) : '');
      setWeightGrams(product.weight_grams || 1000);
      setShippingClass(product.shipping_class || 'standard');
      setIsFragile(Boolean(product.is_fragile));
      setComplementaryIds(Array.isArray(product.complementary_ids) ? product.complementary_ids : []);
      setIsPublished(product.is_published !== 0);
      setIsFeatured(Boolean(product.is_featured));
      setIsBestseller(Boolean(product.is_bestseller));
      setIsNew(Boolean(product.is_new));

      const existingVars = product.variants || [];
      setVariants(
        existingVars.length > 0
          ? existingVars.map((v) => ({
              id: v.id,
              sku: v.sku,
              barcode: v.barcode || '',
              variant_title: v.variant_title,
              regular_price: v.regular_price,
              discount_price: v.discount_price != null ? String(v.discount_price) : '',
              wholesale_price: v.wholesale_price != null ? String(v.wholesale_price) : '',
              cost_price: v.cost_price != null ? String(v.cost_price) : '',
              stock_quantity: v.stock_quantity,
              min_stock_alert: v.min_stock_alert ?? 10,
              warehouse_location: v.warehouse_location || 'انبار مرکزی تهران',
              is_active: v.is_active !== 0,
            }))
          : [
              {
                sku: `${product.sku}-V1`,
                barcode: '',
                variant_title: 'بسته‌بندی استاندارد',
                regular_price: 550000,
                discount_price: '',
                wholesale_price: '480000',
                cost_price: '',
                stock_quantity: 20,
                min_stock_alert: 10,
                warehouse_location: 'انبار مرکزی تهران',
                is_active: true,
              },
            ]
      );
    } else {
      const rand = Math.floor(100 + Math.random() * 900);
      setTitle('');
      setSlug('');
      setSku(`BP-${rand}`);
      setCategoryId(categories[0]?.id || 1);
      setBrandId(brands[0]?.id ? String(brands[0].id) : '');
      setManufacturer('');
      setShortDesc('');
      setDescription('');
      setTagsText('');
      setSpecRows([{ key: 'مناسب برای', value: 'کافی‌شاپ و مصرف حرفه‌ای' }]);
      setMainImage('prod_arabica_beans');
      setMainImageAlt('');
      setGalleryImages([]);
      setUnitType('pack');
      setUnitLabelFa('بسته');
      setMinOrderQty(1);
      setOrderStepQty(1);
      setMaxOrderQty('');
      setWeightGrams(1000);
      setShippingClass('standard');
      setIsFragile(false);
      setComplementaryIds([]);
      setIsPublished(true);
      setIsFeatured(false);
      setIsBestseller(false);
      setIsNew(true);
      setVariants([
        {
          sku: `BP-${rand}-V1`,
          barcode: '',
          variant_title: 'بسته‌بندی استاندارد',
          regular_price: 580000,
          discount_price: '',
          wholesale_price: '495000',
          cost_price: '390000',
          stock_quantity: 30,
          min_stock_alert: 10,
          warehouse_location: 'انبار مرکزی تهران',
          is_active: true,
        },
      ]);
    }
  }, [open, product]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !sku.trim()) {
      notify('عنوان، اسلاگ و کد SKU محصول الزامی است.', 'error');
      setActiveTab('general');
      return;
    }
    if (variants.length === 0) {
      notify('حداقل یک تنوع و قیمت برای محصول لازم است.', 'error');
      setActiveTab('variants');
      return;
    }

    const specifications: Record<string, string> = {};
    for (const row of specRows) {
      if (row.key.trim() && row.value.trim()) {
        specifications[row.key.trim()] = row.value.trim();
      }
    }

    const tags = tagsText
      .split(/[,،]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      sku: sku.trim(),
      category_id: Number(categoryId),
      brand_id: brandId ? Number(brandId) : null,
      manufacturer: manufacturer.trim() || null,
      short_description: shortDesc.trim() || title.trim(),
      description: description.trim() || shortDesc.trim() || title.trim(),
      main_image: mainImage,
      main_image_alt: mainImageAlt.trim() || title.trim(),
      gallery_images: Array.from(new Set([mainImage, ...galleryImages])).filter(Boolean),
      unit_type: unitType,
      unit_label_fa: unitLabelFa.trim() || 'عدد',
      min_order_qty: Math.max(1, Number(minOrderQty) || 1),
      order_step_qty: Math.max(1, Number(orderStepQty) || 1),
      max_order_qty: maxOrderQty ? Number(maxOrderQty) : null,
      weight_grams: Math.max(10, Number(weightGrams) || 500),
      specifications,
      complementary_ids: complementaryIds,
      tags,
      shipping_class: shippingClass,
      is_fragile: isFragile,
      is_published: isPublished,
      is_featured: isFeatured,
      is_bestseller: isBestseller,
      is_new: isNew,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku.trim(),
        barcode: v.barcode.trim() || null,
        variant_title: v.variant_title.trim() || 'استاندارد',
        regular_price: Number(v.regular_price) || 0,
        discount_price: v.discount_price !== '' ? Number(v.discount_price) : null,
        wholesale_price: v.wholesale_price !== '' ? Number(v.wholesale_price) : null,
        cost_price: v.cost_price !== '' ? Number(v.cost_price) : null,
        stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
        min_stock_alert: Math.max(1, Number(v.min_stock_alert) || 10),
        warehouse_location: v.warehouse_location.trim() || 'انبار مرکزی تهران',
        is_active: v.is_active,
      })),
    };

    setSaving(true);
    try {
      if (product) {
        await apiFetch(`/api/admin/products/${product.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify('تغییرات محصول و تصاویر با موفقیت ذخیره شد');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('محصول جدید با موفقیت ایجاد و در کاتالوگ ثبت شد');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      notify(err.message || 'خطا در ذخیره محصول', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        sku: `${sku || 'BP'}-V${prev.length + 1}`,
        barcode: '',
        variant_title: `بسته‌بندی ${prev.length + 1}`,
        regular_price: prev[0]?.regular_price || 500000,
        discount_price: '',
        wholesale_price: '',
        cost_price: '',
        stock_quantity: 15,
        min_stock_alert: 10,
        warehouse_location: 'انبار مرکزی تهران',
        is_active: true,
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-5xl rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-[#111111] text-white flex items-center justify-between gap-4 border-b-2 border-[#B11116]">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold truncate">
              {product ? `ویرایش محصول: ${product.title}` : 'افزودن محصول جدید به کاتالوگ'}
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              تغییر تصویر، گالری، قیمت خرده و عمده، موجودی انبار و مشخصات فنی
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Tabs */}
        <div className="px-6 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-1 overflow-x-auto shrink-0">
          {[
            { id: 'general', label: '۱. عمومی و مشخصات فنی' },
            { id: 'images', label: '۲. تصویر اصلی و گالری' },
            { id: 'variants', label: '۳. تنوع، قیمت و عمده‌فروشی' },
            { id: 'shipping', label: '۴. ارسال، مکمل و انتشار' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'border-[#B11116] text-[#B11116] bg-white'
                  : 'border-transparent text-[#525252] hover:text-[#111111]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#111111] mb-1.5">عنوان محصول فارسی *</label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثلاً دانه قهوه اسپرسو عربیکا اتیوپی ۱ کیلویی"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl focus:border-[#111111] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">کد اصلی محصول (SKU) *</label>
                  <input
                    required
                    dir="ltr"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left focus:border-[#111111] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">نشانی URL (اسلاگ انگلیسی) *</label>
                  <div className="flex gap-1.5">
                    <input
                      required
                      dir="ltr"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="ethiopia-arabica-1kg"
                      className="flex-1 px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left focus:border-[#111111] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSlug(generateSlug(slug || sku || title))}
                      className="px-3 border border-[#E5E5E5] rounded-xl hover:border-[#111111] bg-[#F8F8F8] cursor-pointer"
                      title="تولید خودکار اسلاگ"
                    >
                      <Wand2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">دسته‌بندی *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">برند</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                  >
                    <option value="">بدون برند خاص</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">تولیدکننده / کارخانه رُست</label>
                  <input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="مثلاً رستری اختصاصی باریستاپرو"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">برچسب‌ها (با کاما جدا کنید)</label>
                  <input
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="اسپرسو، عمده، کافئین بالا"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#111111] mb-1.5">توضیح کوتاه معرفی کالا</label>
                <input
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  placeholder="خلاصه یک‌خطی برای کارت محصول و پیش‌نمایش بالای صفحه"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111111] mb-1.5">توضیحات کامل و تخصصی محصول</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="شرح کامل مشخصات عصاره‌گیری، کاربرد کافه‌ای، نکات نگهداری..."
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                />
              </div>

              {/* Specifications Builder */}
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#111111]">جدول مشخصات فنی</span>
                  <button
                    type="button"
                    onClick={() => setSpecRows((prev) => [...prev, { key: '', value: '' }])}
                    className="px-3 py-1.5 bg-[#111111] text-white rounded-lg font-bold inline-flex items-center gap-1 hover:bg-[#B11116] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن ردیف</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {specRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={row.key}
                        onChange={(e) =>
                          setSpecRows((prev) => prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))
                        }
                        placeholder="عنوان ویژگی (مثلاً درجه رُست)"
                        className="flex-1 px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                      />
                      <input
                        value={row.value}
                        onChange={(e) =>
                          setSpecRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                        }
                        placeholder="مقدار (مثلاً مدیوم دارک)"
                        className="flex-1 px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setSpecRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-[#B11116] hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-6">
              {/* Main Image Box */}
              <div className="p-4 sm:p-5 border border-[#E5E5E5] rounded-2xl bg-[#FAFAFA] flex flex-col sm:flex-row items-start gap-5">
                <div className="w-full sm:w-56 aspect-[4/3] rounded-xl overflow-hidden bg-white border border-[#E5E5E5] shrink-0">
                  <img
                    src={resolveMediaUrl(mainImage)}
                    alt={mainImageAlt || title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <div>
                    <div className="text-sm font-extrabold text-[#111111]">تصویر اصلی محصول</div>
                    <p className="text-xs text-[#525252] mt-1">
                      می‌توانید یک عکس جدید مستقیم از کامپیوتر یا موبایل آپلود کنید یا از تصاویر کتابخانه رسانه انتخاب نمایید.
                    </p>
                  </div>
                  <div>
                    <label className="block font-bold text-[#111111] mb-1">متن جایگزین تصویر (ALT سئو)</label>
                    <input
                      value={mainImageAlt}
                      onChange={(e) => setMainImageAlt(e.target.value)}
                      placeholder="توضیح تصویر برای موتورهای جستجو"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E5] rounded-xl"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPickerTarget('main')}
                      className="min-h-[42px] px-5 py-2.5 bg-[#B11116] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>تغییر / آپلود تصویر اصلی</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-[#111111]">گالری تصاویر تکمیلی محصول</div>
                    <div className="text-xs text-[#525252]">نمایش در اسلایدر صفحه محصول</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerTarget('gallery')}
                    className="min-h-[40px] px-4 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#B11116] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن تصویر به گالری</span>
                  </button>
                </div>

                {galleryImages.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#D4D4D4] rounded-xl text-center text-xs text-[#525252]">
                    هنوز تصویر اضافه‌ای برای گالری انتخاب نشده است.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    {galleryImages.map((img, idx) => (
                      <div key={idx} className="border border-[#E5E5E5] rounded-xl overflow-hidden bg-white">
                        <div className="aspect-[4/3] bg-[#F5F5F5]">
                          <img src={resolveMediaUrl(img)} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setMainImage(img)}
                            className={`px-2 py-1 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${
                              mainImage === img ? 'bg-[#111111] text-white' : 'bg-[#F8F8F8] text-[#111111] hover:bg-[#B11116] hover:text-white'
                            }`}
                          >
                            <Star className="w-3 h-3" />
                            <span>{mainImage === img ? 'اصلی' : 'اصلی کن'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-[#B11116] hover:bg-rose-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'variants' && (
            <div className="space-y-5">
              {/* Unit & Order Rules */}
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-bold text-[#111111] mb-1">نوع واحد</label>
                  <select
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                  >
                    <option value="kg">کیلوگرم (kg)</option>
                    <option value="pack">بسته (pack)</option>
                    <option value="carton">کارتن (carton)</option>
                    <option value="bottle">بطری (bottle)</option>
                    <option value="piece">عدد (piece)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1">برچسب واحد فارسی</label>
                  <input
                    value={unitLabelFa}
                    onChange={(e) => setUnitLabelFa(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1">حداقل سفارش</label>
                  <input
                    type="number"
                    min={1}
                    value={minOrderQty}
                    onChange={(e) => setMinOrderQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1">گام افزایش سفارش</label>
                  <input
                    type="number"
                    min={1}
                    value={orderStepQty}
                    onChange={(e) => setOrderStepQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1">حداکثر مجاز (اختیاری)</label>
                  <input
                    type="number"
                    min={1}
                    value={maxOrderQty}
                    onChange={(e) => setMaxOrderQty(e.target.value)}
                    placeholder="نامحدود"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Variants List */}
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-[#111111]">
                  تنوع‌ها، قیمت مصرف‌کننده، قیمت همکار عمده (B2B) و موجودی انبار
                </div>
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="min-h-[38px] px-4 py-1.5 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#B11116] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن تنوع جدید</span>
                </button>
              </div>

              <div className="space-y-3">
                {variants.map((v, idx) => (
                  <div key={idx} className="p-4 border border-[#E5E5E5] rounded-xl bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F0F0F0]">
                      <span className="font-extrabold text-[#111111]">تنوع #{idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={v.is_active}
                            onChange={(e) =>
                              setVariants((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, is_active: e.target.checked } : row))
                              )
                            }
                          />
                          <span>فعال در فروشگاه</span>
                        </label>
                        {variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-[#B11116] hover:underline font-bold cursor-pointer"
                          >
                            حذف تنوع
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[#525252] mb-1">عنوان تنوع (مثلاً ۱ کیلویی)</label>
                        <input
                          required
                          value={v.variant_title}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, variant_title: e.target.value } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[#525252] mb-1">SKU تنوع</label>
                        <input
                          required
                          dir="ltr"
                          value={v.sku}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, sku: e.target.value } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-[#525252] mb-1">بارکد (اختیاری)</label>
                        <input
                          dir="ltr"
                          value={v.barcode}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, barcode: e.target.value } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-[#525252] mb-1">محل انبار</label>
                        <input
                          value={v.warehouse_location}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, warehouse_location: e.target.value } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#111111] mb-1">قیمت عادی (تومان)</label>
                        <input
                          required
                          type="number"
                          min={0}
                          value={v.regular_price}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, regular_price: Number(e.target.value) } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[#525252] mb-1">قیمت با تخفیف (تومان)</label>
                        <input
                          type="number"
                          min={0}
                          value={v.discount_price}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, discount_price: e.target.value } : row))
                            )
                          }
                          placeholder="ندارد"
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#B11116] mb-1">قیمت عمده B2B (تومان)</label>
                        <input
                          type="number"
                          min={0}
                          value={v.wholesale_price}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, wholesale_price: e.target.value } : row))
                            )
                          }
                          placeholder="قیمت همکار"
                          className="w-full px-3 py-2 border border-[#B11116]/30 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[#525252] mb-1">قیمت خرید تمام‌شده (داخلی)</label>
                        <input
                          type="number"
                          min={0}
                          value={v.cost_price}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, cost_price: e.target.value } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#111111] mb-1">موجودی فعلی انبار</label>
                        <input
                          required
                          type="number"
                          min={0}
                          value={v.stock_quantity}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, stock_quantity: Number(e.target.value) } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[#525252] mb-1">آستانه هشدار کسری موجودی</label>
                        <input
                          type="number"
                          min={1}
                          value={v.min_stock_alert}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, min_stock_alert: Number(e.target.value) } : row))
                            )
                          }
                          className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">وزن واحد برای محاسبه باربری (گرم)</label>
                  <input
                    type="number"
                    min={10}
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111111] mb-1.5">کلاس حمل‌ونقل</label>
                  <select
                    value={shippingClass}
                    onChange={(e) => setShippingClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                  >
                    <option value="standard">استاندارد (پیک و پست)</option>
                    <option value="heavy">حجیم و سنگین (باربری کافه‌ای)</option>
                    <option value="express">ارسال فوری ویژه تهران</option>
                  </select>
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="inline-flex items-center gap-2 font-bold text-[#111111] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFragile}
                      onChange={(e) => setIsFragile(e.target.checked)}
                    />
                    <span>کالای شکستنی / نیازمند بسته‌بندی حباب‌دار</span>
                  </label>
                </div>
              </div>

              {/* Publish Flags */}
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] flex flex-wrap gap-5 font-bold text-[#111111]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                  <span>منتشرشده در فروشگاه</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} />
                  <span>نمایش در پرفروش‌ترین‌ها</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                  <span>محصول ویژه صفحه اصلی</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
                  <span>برچسب محصول جدید</span>
                </label>
              </div>

              {/* Complementary Products */}
              <div className="space-y-2.5">
                <div className="font-bold text-[#111111]">محصولات مکمل پیشنهادی در صفحه کالا و سبد خرید:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-[#E5E5E5] rounded-xl bg-white">
                  {allProducts
                    .filter((p) => !product || p.id !== product.id)
                    .map((p) => {
                      const checked = complementaryIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'border-[#B11116] bg-[#FDF2F2]' : 'border-[#F0F0F0] hover:bg-[#FAFAFA]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setComplementaryIds((prev) => [...prev, p.id]);
                              } else {
                                setComplementaryIds((prev) => prev.filter((id) => id !== p.id));
                              }
                            }}
                          />
                          <span className="truncate font-semibold text-[#111111]">{p.title}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 border border-[#111111] text-[#111111] text-sm font-bold rounded-xl hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[46px] px-7 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'در حال ذخیره...' : product ? 'ذخیره تغییرات محصول' : 'ایجاد محصول در فروشگاه'}
          </button>
        </div>
      </form>

      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === 'main' ? 'انتخاب یا آپلود تصویر اصلی محصول' : 'افزودن تصویر به گالری محصول'}
        onSelect={(url, alt) => {
          if (pickerTarget === 'main') {
            setMainImage(url);
            if (alt && !mainImageAlt) setMainImageAlt(alt);
          } else if (pickerTarget === 'gallery') {
            setGalleryImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
          }
        }}
      />
    </div>
  );
}
