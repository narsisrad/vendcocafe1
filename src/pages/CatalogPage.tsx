import React, { useEffect, useState } from 'react';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { apiFetch, toPersianDigits } from '../lib/format';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { Brand, Category, Product } from '../types';

export function CatalogPage({
  initialCategorySlug = '',
  initialBrandSlug = '',
}: {
  initialCategorySlug?: string;
  initialBrandSlug?: string;
}) {
  const { currentPath, navigate } = useStore();
  const urlParams = new URLSearchParams(currentPath.split('?')[1] || '');

  const [q, setQ] = useState(urlParams.get('q') || '');
  const [category, setCategory] = useState(initialCategorySlug || urlParams.get('category') || '');
  const [brand, setBrand] = useState(initialBrandSlug || urlParams.get('brand') || '');
  const [inStock, setInStock] = useState(urlParams.get('inStock') === '1');
  const [discounted, setDiscounted] = useState(urlParams.get('discounted') === '1');
  const [minPrice, setMinPrice] = useState(urlParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(urlParams.get('maxPrice') || '');
  const [sort, setSort] = useState(urlParams.get('sort') || 'bestselling');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    setCategory(initialCategorySlug || urlParams.get('category') || '');
    setBrand(initialBrandSlug || urlParams.get('brand') || '');
    setQ(urlParams.get('q') || '');
  }, [initialCategorySlug, initialBrandSlug, currentPath]);

  useEffect(() => {
    apiFetch<{ categories: Category[]; brands: Brand[] }>('/api/storefront/home').then((res) => {
      setCategories(res.categories);
      setBrands(res.brands);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (brand) params.set('brand', brand);
    if (inStock) params.set('inStock', '1');
    if (discounted) params.set('discounted', '1');
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sort) params.set('sort', sort);

    apiFetch<{ products: Product[] }>(`/api/products?${params.toString()}`)
      .then((res) => setProducts(res.products))
      .finally(() => setLoading(false));
  }, [q, category, brand, inStock, discounted, minPrice, maxPrice, sort]);

  const resetFilters = () => {
    setQ('');
    setCategory('');
    setBrand('');
    setInStock(false);
    setDiscounted(false);
    setMinPrice('');
    setMaxPrice('');
    setSort('bestselling');
    navigate('/products');
  };

  const activeCategoryObj = categories.find((c) => c.slug === category);

  const FilterPanel = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
        <span className="text-sm font-bold text-[#111111] flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#B11116]" />
          فیلترهای تخصصی
        </span>
        <button
          type="button"
          onClick={resetFilters}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B11116] hover:bg-[#FDF2F2] cursor-pointer transition-colors"
        >
          حذف فیلترها
        </button>
      </div>

      {/* Availability & Discount */}
      <div className="space-y-3">
        <label className="flex items-center justify-between text-xs font-medium text-[#111111] cursor-pointer">
          <span>فقط کالاهای موجود در انبار</span>
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="accent-[#B11116] w-4 h-4"
          />
        </label>
        <label className="flex items-center justify-between text-xs font-medium text-[#111111] cursor-pointer">
          <span>فقط کالاهای تخفیف‌دار</span>
          <input
            type="checkbox"
            checked={discounted}
            onChange={(e) => setDiscounted(e.target.checked)}
            className="accent-[#B11116] w-4 h-4"
          />
        </label>
      </div>

      {/* Category Filter */}
      <div className="pt-4 border-t border-[#E5E5E5]">
        <h3 className="text-xs font-bold text-[#111111] mb-2.5">دسته‌بندی</h3>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setCategory('')}
            className={`w-full text-right text-xs sm:text-sm min-h-[40px] py-2 px-3 rounded-lg cursor-pointer transition-colors ${
              !category ? 'bg-[#111111] text-white font-semibold' : 'text-[#525252] hover:bg-[#F8F8F8] hover:text-[#111111]'
            }`}
          >
            همه دسته‌بندی‌ها
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={`w-full text-right text-xs sm:text-sm min-h-[40px] py-2 px-3 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                category === c.slug
                  ? 'bg-[#B11116] text-white font-semibold'
                  : 'text-[#525252] hover:bg-[#F8F8F8] hover:text-[#111111]'
              }`}
            >
              <span>{c.name}</span>
              <span className="tabular-nums text-[11px] opacity-85">{toPersianDigits(c.product_count || 0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Filter */}
      <div className="pt-4 border-t border-[#E5E5E5]">
        <h3 className="text-xs font-bold text-[#111111] mb-2.5">برند سازنده</h3>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setBrand('')}
            className={`w-full text-right text-xs sm:text-sm min-h-[40px] py-2 px-3 rounded-lg cursor-pointer transition-colors ${
              !brand ? 'bg-[#111111] text-white font-semibold' : 'text-[#525252] hover:bg-[#F8F8F8] hover:text-[#111111]'
            }`}
          >
            همه برندها
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBrand(b.slug)}
              className={`w-full text-right text-xs sm:text-sm min-h-[40px] py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                brand === b.slug
                  ? 'bg-[#B11116] text-white font-semibold'
                  : 'text-[#525252] hover:bg-[#F8F8F8] hover:text-[#111111]'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="pt-4 border-t border-[#E5E5E5]">
        <h3 className="text-xs font-bold text-[#111111] mb-2.5">محدوده قیمت (تومان)</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="از..."
            className="w-full px-2.5 py-1.5 text-xs border border-[#E5E5E5] rounded-lg tabular-nums"
          />
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="تا..."
            className="w-full px-2.5 py-1.5 text-xs border border-[#E5E5E5] rounded-lg tabular-nums"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-8">
      {/* Breadcrumb & Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-[#666666] mb-2">
          <a
            href="/"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                navigate('/');
              }
            }}
            className="hover:text-[#B11116] cursor-pointer transition-colors"
          >
            خانه
          </a>
          <span>/</span>
          <span className="text-[#111111] font-medium">
            {activeCategoryObj ? activeCategoryObj.name : 'فروشگاه ملزومات کافی‌شاپ'}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-[#111111]">
            {activeCategoryObj ? activeCategoryObj.name : q ? `نتایج جستجو برای «${q}»` : 'همه ملزومات و تجهیزات کافی‌شاپ'}
          </h1>
          <span className="text-xs text-[#666666] tabular-nums">
            {toPersianDigits(products.length)} محصول یافت شد
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#E5E5E5] rounded-xl p-5 sticky top-24">
          {FilterPanel}
        </aside>

        {/* Product Listing Column */}
        <div className="lg:col-span-9 space-y-5">
          {/* Sort Bar */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#595959] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                مرتب‌سازی:
              </span>
              {[
                { key: 'bestselling', label: 'پرفروش‌ترین' },
                { key: 'newest', label: 'جدیدترین' },
                { key: 'price_asc', label: 'ارزان‌ترین' },
                { key: 'price_desc', label: 'گران‌ترین' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={`min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
                    sort === s.key
                      ? 'bg-[#111111] text-white'
                      : 'text-[#525252] hover:bg-[#FDF2F2] hover:text-[#B11116]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-bold bg-[#111111] text-white rounded-xl cursor-pointer"
            >
              <Filter className="w-4 h-4" />
              فیلترها
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 bg-[#E5E5E5] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-[#E5E5E5] rounded-xl p-12 text-center">
              <p className="text-base font-bold text-[#111111] mb-2">محصولی با فیلترهای انتخابی یافت نشد</p>
              <p className="text-xs text-[#595959] mb-4">می‌توانید فیلترها را بازنشانی کنید تا کل موجودی نمایش داده شود.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
              >
                نمایش همه محصولات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end lg:hidden">
          <div className="w-full max-w-xs bg-white h-full p-5 overflow-y-auto">
            <div className="flex justify-end mb-3">
              <button type="button" onClick={() => setMobileFilterOpen(false)} className="p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>
            {FilterPanel}
          </div>
        </div>
      )}
    </div>
  );
}
