import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Heart,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Star,
} from 'lucide-react';
import { apiFetch, formatPersianDate, formatToman, toPersianDigits } from '../lib/format';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { useStore } from '../context/StoreContext';
import { Product, ProductVariant } from '../types';
import { ProductCard } from '../components/ProductCard';
import { AppLink } from '../components/AppLink';

export function ProductDetailPage({ slug }: { slug: string }) {
  const { addToCart, user, setAuthModalOpen, notify } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [complementary, setComplementary] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState('');
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'desc' | 'reviews'>('specs');
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);

  // Review form state
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<{
      product: Product;
      variants: ProductVariant[];
      reviews: any[];
      complementary: Product[];
    }>(`/api/products/${slug}`)
      .then((res) => {
        setProduct(res.product);
        setVariants(res.variants);
        setSelectedVariant(res.variants[0] || null);
        setReviews(res.reviews);
        setComplementary(res.complementary);
        setActiveImage(res.product.main_image);
        setQty(res.product.min_order_qty || 1);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-10">
        <div className="h-96 bg-[#E5E5E5] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!product || !selectedVariant) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">محصول مورد نظر یافت نشد</h1>
        <AppLink
          to="/products"
          className="inline-flex items-center justify-center min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors"
        >
          بازگشت به فروشگاه
        </AppLink>
      </div>
    );
  }

  const gallery = Array.from(new Set([product.main_image, ...(product.gallery_images || [])]));
  const isWholesaleApplied = Boolean(product.is_wholesale_price && selectedVariant.wholesale_price && selectedVariant.wholesale_price < selectedVariant.regular_price);
  const unitPrice = isWholesaleApplied
    ? (selectedVariant.wholesale_price as number)
    : selectedVariant.discount_price && selectedVariant.discount_price < selectedVariant.regular_price
    ? selectedVariant.discount_price
    : selectedVariant.regular_price;
  const discountPct =
    selectedVariant.regular_price > 0 && unitPrice < selectedVariant.regular_price
      ? Math.round(
          ((selectedVariant.regular_price - unitPrice) / selectedVariant.regular_price) * 100
        )
      : 0;
  const availableStock = selectedVariant.available_stock;
  const step = product.order_step_qty || 1;
  const minQty = product.min_order_qty || 1;

  const handleToggleWishlist = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const res = await apiFetch<{ wishlisted: boolean }>('/api/customer/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id }),
      });
      setWishlisted(res.wishlisted);
      notify(res.wishlisted ? 'به لیست علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد', 'info');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await apiFetch<{ review: any }>(`/api/products/${product.slug}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          author_name: user?.name || reviewAuthor,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setReviews((prev) => [res.review, ...prev]);
      setReviewComment('');
      notify('دیدگاه شما با موفقیت ثبت شد');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-8 space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#666666] flex-wrap">
        <AppLink to="/" className="hover:text-[#B11116] transition-colors">
          خانه
        </AppLink>
        <span>/</span>
        <AppLink
          to={`/category/${product.category_slug}`}
          className="hover:text-[#B11116] transition-colors"
        >
          {product.category_name}
        </AppLink>
        <span>/</span>
        <span className="text-[#111111] font-medium">{product.title}</span>
      </nav>

      {/* Main Contiguous PDP Module */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Product Image Gallery */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-3">
          <div className="aspect-[4/3] w-full bg-[#F5F5F5] rounded-xl overflow-hidden border border-[#E5E5E5]">
            <img
              src={resolveMediaUrl(activeImage)}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {gallery.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`w-20 aspect-[4/3] rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                    activeImage === img ? 'border-[#B11116]' : 'border-[#E5E5E5]'
                  }`}
                >
                  <img src={resolveMediaUrl(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchase Box */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#666666] mb-2">
                <span>{product.brand_name}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">کد کالا: {selectedVariant.sku}</span>
              </div>
              <h1 className="text-xl lg:text-2xl font-extrabold text-[#111111] leading-snug">
                {product.title}
              </h1>
              <p className="text-sm text-[#595959] mt-3 leading-relaxed">
                {product.short_description}
              </p>
            </div>

            {/* Variant Selector */}
            <div className="pt-4 border-t border-[#F0F0F0]">
              <div className="text-xs font-bold text-[#111111] mb-2.5">
                انتخاب بسته‌بندی / تنوع کالا:
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = v.id === selectedVariant.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariant(v);
                        setQty(minQty);
                      }}
                      className={`min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'border-[#111111] bg-[#111111] text-white'
                          : 'border-[#E5E5E5] bg-white text-[#111111] hover:border-[#B11116] hover:text-[#B11116]'
                      }`}
                    >
                      {v.variant_title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Unit & Step Rules Notice */}
            <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-1.5 text-xs text-[#595959]">
              <div>
                واحد فروش: <strong className="text-[#111111]">{product.unit_label_fa}</strong>
                {step > 1 && (
                  <span> · افزایش تعداد در مضارب <strong className="text-[#B11116] tabular-nums">{toPersianDigits(step)}</strong></span>
                )}
              </div>
              <div>
                حداقل تعداد سفارش: <strong className="tabular-nums text-[#111111]">{toPersianDigits(minQty)} {product.unit_label_fa}</strong>
              </div>
            </div>

            {/* Key Specs Preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#111111]">ویژگی‌های کلیدی:</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(product.specifications || {})
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div key={k} className="bg-[#FAFAFA] border border-[#F0F0F0] px-3 py-2 rounded-lg">
                      <dt className="text-[#666666]">{k}</dt>
                      <dd className="font-semibold text-[#111111] mt-0.5">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>

          {/* Sticky Buy Box (White & Vendco Red) */}
          <div className="md:col-span-5 bg-white border border-[#F2D6D7] rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#595959]">وضعیت انبار</span>
              {availableStock > 10 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E6B4B]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  موجود در انبار ({toPersianDigits(availableStock)})
                </span>
              ) : availableStock > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  تنها {toPersianDigits(availableStock)} {product.unit_label_fa} باقی مانده
                </span>
              ) : (
                <span className="text-xs font-bold text-[#B11116]">اتمام موجودی</span>
              )}
            </div>

            <div className="pt-3 border-t border-[#F2D6D7]">
              {discountPct > 0 && (
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#8C8C8C] line-through tabular-nums">
                    {formatToman(selectedVariant.regular_price)}
                  </span>
                  <span className="text-xs font-bold text-white bg-[#B11116] px-2 py-0.5 rounded tabular-nums">
                    {toPersianDigits(discountPct)}٪
                  </span>
                </div>
              )}
              <div className="text-2xl font-extrabold text-[#B11116] tabular-nums">
                {formatToman(unitPrice)}
              </div>
              <div className="text-[11px] text-[#666666] mt-0.5">قیمت برای هر {product.unit_label_fa}</div>
            </div>

            {/* Quantity Stepper */}
            {availableStock > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#595959]">تعداد انتخابی:</span>
                  <div className="inline-flex items-center border border-[#E5E5E5] bg-[#F8F8F8] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setQty((prev) => Math.min(availableStock, prev + step))}
                      className="w-11 h-11 flex items-center justify-center text-[#111111] hover:text-[#B11116] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="px-4 text-base font-extrabold tabular-nums">{toPersianDigits(qty)}</span>
                    <button
                      type="button"
                      onClick={() => setQty((prev) => Math.max(minQty, prev - step))}
                      className="w-11 h-11 flex items-center justify-center text-[#111111] hover:text-[#B11116] cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#525252]">
                  <span>جمع کل ردیف:</span>
                  <strong className="text-base text-[#111111] tabular-nums">
                    {formatToman(unitPrice * qty)}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => addToCart(product.id, selectedVariant.id, qty, true)}
                  className="w-full min-h-[52px] py-3.5 px-6 bg-[#B11116] text-white text-base font-bold rounded-xl hover:bg-[#8E0D11] transition-colors duration-200 inline-flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>افزودن به سبد خرید</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleWishlist}
              className="w-full min-h-[48px] py-3 px-5 border border-[#111111] bg-white text-sm font-bold text-[#111111] rounded-xl hover:bg-[#111111] hover:text-white transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-[#B11116] text-[#B11116]' : ''}`} />
              <span>{wishlisted ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}</span>
            </button>

            <div className="pt-3 border-t border-[#E5E5E5] flex items-center gap-2 text-[11px] text-[#595959]">
              <Truck className="w-4 h-4 text-[#B11116] shrink-0" />
              <span>آماده ارسال از انبار مرکزی تهران · تضمین سلامت کالا</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Specifications / Description / Customer Reviews */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 gap-1">
          {[
            { id: 'specs', label: 'مشخصات فنی' },
            { id: 'desc', label: 'توضیحات تخصصی محصول' },
            { id: 'reviews', label: `نظرات خریداران (${toPersianDigits(reviews.length)})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[48px] px-6 py-3.5 text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#B11116] text-[#B11116] bg-white'
                  : 'border-transparent text-[#525252] hover:text-[#111111]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 lg:p-8">
          {activeTab === 'specs' && (
            <div className="max-w-2xl divide-y divide-[#F0F0F0]">
              {Object.entries(product.specifications || {}).map(([k, v]) => (
                <div key={k} className="py-3 grid grid-cols-3 gap-4 text-sm">
                  <span className="text-[#666666]">{k}</span>
                  <span className="col-span-2 font-medium text-[#111111]">{String(v)}</span>
                </div>
              ))}
              <div className="py-3 grid grid-cols-3 gap-4 text-sm">
                <span className="text-[#666666]">وزن واحد</span>
                <span className="col-span-2 font-medium text-[#111111] tabular-nums">
                  {toPersianDigits(product.weight_grams)} گرم
                </span>
              </div>
            </div>
          )}

          {activeTab === 'desc' && (
            <div className="prose max-w-3xl text-sm text-[#111111] leading-loose whitespace-pre-line">
              {product.description}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-sm text-[#595959]">
                    هنوز دیدگاهی برای این محصول ثبت نشده است. اولین خریداری باشید که تجربه خود را می‌نویسید.
                  </p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-[#111111]">{r.author_name}</span>
                        <div className="flex items-center gap-1 text-amber-500 text-xs tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span>{toPersianDigits(r.rating)} از ۵</span>
                        </div>
                      </div>
                      <p className="text-sm text-[#111111] leading-relaxed">{r.comment}</p>
                      <div className="text-[11px] text-[#8C8C8C] mt-2">
                        {formatPersianDate(r.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleReviewSubmit} className="lg:col-span-5 bg-[#FAFAFA] p-5 rounded-xl border border-[#E5E5E5] space-y-3">
                <h3 className="text-sm font-bold text-[#111111]">ثبت دیدگاه خریدار</h3>
                {!user && (
                  <div>
                    <label className="block text-xs text-[#595959] mb-1">نام شما</label>
                    <input
                      type="text"
                      required
                      value={reviewAuthor}
                      onChange={(e) => setReviewAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-[#595959] mb-1">امتیاز شما</label>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded-lg"
                  >
                    <option value={5}>۵ - عالی</option>
                    <option value={4}>۴ - خوب</option>
                    <option value={3}>۳ - متوسط</option>
                    <option value={2}>۲ - ضعیف</option>
                    <option value={1}>۱ - نامناسب</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#595959] mb-1">متن دیدگاه</label>
                  <textarea
                    required
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="کیفیت محصول در استفاده کافه چگونه بود؟"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full min-h-[48px] py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
                >
                  {submittingReview ? 'در حال ثبت...' : 'ارسال دیدگاه'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Complementary Products */}
      {complementary.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-[#111111] mb-4">محصولات مکمل و پیشنهادی کنار این کالا</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {complementary.map((cp) => (
              <ProductCard key={cp.id} product={cp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
