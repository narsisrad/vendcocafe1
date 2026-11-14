import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Truck,
  Tag,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { formatToman, toPersianDigits } from '../lib/format';
import { AppLink } from '../components/AppLink';

export function CartPage() {
  const {
    cart,
    updateCartItem,
    removeCartItem,
    clearCart,
    applyCoupon,
    addToCart,
  } = useStore();
  const [couponInput, setCouponInput] = useState('');

  const items = cart?.items || [];

  const handleCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyCoupon(couponInput);
  };

  if (!cart || items.length === 0) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-16">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center max-w-xl mx-auto">
          <ShoppingBag className="w-14 h-14 text-[#8C8C8C] mx-auto mb-4" />
          <h1 className="text-xl font-extrabold text-[#111111] mb-2">سبد خرید شما در حال حاضر خالی است</h1>
          <p className="text-sm text-[#595959] mb-6">
            می‌توانید برای تامین دان قهوه، لیوان‌های دوجداره و سیروپ‌های تخصصی به فروشگاه مراجعه کنید.
          </p>
          <AppLink
            to="/products"
            className="inline-flex items-center justify-center min-h-[50px] px-8 py-3.5 bg-[#B11116] text-white text-base font-bold rounded-xl hover:bg-[#111111] transition-colors"
          >
            مشاهده محصولات فروشگاه
          </AppLink>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#111111]">
          سبد خرید شما ({toPersianDigits(items.length)} ردیف کالا)
        </h1>
        <button
          type="button"
          onClick={clearCart}
          className="min-h-[42px] px-4 py-2 rounded-xl border border-[#F2D6D7] text-sm font-semibold text-[#B11116] hover:bg-[#FDF2F2] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          پاک کردن کل سبد
        </button>
      </div>

      {/* Free Shipping Progress Banner */}
      <div className="bg-[#FDF2F2]/60 border border-[#F2D6D7] rounded-xl p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="inline-flex items-center gap-2 font-semibold text-[#1A1A1A]">
            <Truck className="w-4 h-4 text-[#B11116]" />
            {cart.free_shipping_remaining === 0 ? (
              <span className="text-[#B11116]">
                عالی! سفارش شما از سقف ارسال رایگان پیک تهران عبور کرد.
              </span>
            ) : (
              <span>
                با افزودن{' '}
                <strong className="text-[#B11116] tabular-nums">
                  {formatToman(cart.free_shipping_remaining)}
                </strong>{' '}
                کالای دیگر، از ارسال رایگان پیک تهران بهره‌مند شوید.
              </span>
            )}
          </span>
          <span className="tabular-nums text-[#B11116] font-semibold">{toPersianDigits(cart.free_shipping_percent)}٪</span>
        </div>
        <div className="h-2 w-full bg-[#F2D6D7] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#B11116] transition-all duration-300"
            style={{ width: `${cart.free_shipping_percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cart Items List */}
        <div className="lg:col-span-8 bg-white border border-[#E5E5E5] rounded-2xl divide-y divide-[#F0F0F0]">
          {items.map((item) => (
            <div key={item.item_id} className="p-5 flex flex-col sm:flex-row gap-5">
              <AppLink to={`/product/${item.product_slug}`} className="shrink-0">
                <img
                  src={resolveMediaUrl(item.main_image)}
                  alt={item.product_title}
                  className="w-28 h-28 rounded-xl object-cover bg-[#F5F5F5]"
                />
              </AppLink>

              <div className="flex-1 flex flex-col justify-between gap-3">
                <div>
                  <AppLink
                    to={`/product/${item.product_slug}`}
                    className="inline-block text-base font-bold text-[#111111] hover:text-[#B11116] text-right transition-colors"
                  >
                    {item.product_title}
                  </AppLink>
                  <div className="text-xs text-[#666666] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>تنوع: {item.variant_title}</span>
                    <span>·</span>
                    <span className="tabular-nums">SKU: {item.sku}</span>
                    {item.order_step_qty > 1 && (
                      <>
                        <span>·</span>
                        <span className="text-[#B11116] font-medium">
                          ضریب سفارش: {toPersianDigits(item.order_step_qty)} {item.unit_label_fa}
                        </span>
                      </>
                    )}
                  </div>
                  {!item.is_available && (
                    <p className="mt-2 text-xs text-[#B11116] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      موجودی کافی نیست (موجودی فعلی: {toPersianDigits(item.available_stock)})
                    </p>
                  )}
                  {item.is_available && item.is_low_stock && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      تنها {toPersianDigits(item.available_stock)} {item.unit_label_fa} در انبار باقی مانده است.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center border border-[#E5E5E5] rounded-xl bg-[#F8F8F8]">
                      <button
                        type="button"
                        onClick={() => updateCartItem(item.item_id, item.quantity + item.order_step_qty)}
                        className="w-10 h-10 flex items-center justify-center hover:text-[#B11116] cursor-pointer"
                        aria-label="افزایش"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="px-3.5 text-sm font-bold tabular-nums">
                        {toPersianDigits(item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity <= item.min_order_qty
                            ? removeCartItem(item.item_id)
                            : updateCartItem(item.item_id, item.quantity - item.order_step_qty)
                        }
                        className="w-10 h-10 flex items-center justify-center hover:text-[#B11116] cursor-pointer"
                        aria-label="کاهش"
                      >
                        {item.quantity <= item.min_order_qty ? (
                          <Trash2 className="w-4 h-4 text-[#B11116]" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <span className="text-xs text-[#666666] tabular-nums">
                      فی: {formatToman(item.unit_price)}
                    </span>
                  </div>

                  <div className="text-left">
                    {item.line_discount > 0 && (
                      <div className="text-xs text-[#1E6B4B] tabular-nums">
                        سود شما: {formatToman(item.line_discount)}
                      </div>
                    )}
                    <div className="text-base font-extrabold text-[#111111] tabular-nums">
                      {formatToman(item.line_total)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sticky Invoice Summary */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#111111] pb-3 border-b border-[#F0F0F0]">
              خلاصه فاکتور سبد خرید
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[#595959]">
                <span>قیمت کالاها ({toPersianDigits(cart.total_quantity)} واحد)</span>
                <span className="tabular-nums">{formatToman(cart.subtotal_regular)}</span>
              </div>

              {cart.product_discount_amount > 0 && (
                <div className="flex justify-between text-[#1E6B4B] font-medium">
                  <span>تخفیف کالاها</span>
                  <span className="tabular-nums">− {formatToman(cart.product_discount_amount)}</span>
                </div>
              )}

              {cart.coupon_discount_amount > 0 && (
                <div className="flex justify-between text-[#1E6B4B] font-medium">
                  <span>کد تخفیف ({cart.coupon_code})</span>
                  <span className="tabular-nums">− {formatToman(cart.coupon_discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#595959]">
                <span>وزن تقریبی مرسوله</span>
                <span className="tabular-nums">
                  {toPersianDigits((cart.total_weight_grams / 1000).toFixed(1))} کیلوگرم
                </span>
              </div>
            </div>

            {/* Coupon Form */}
            <form onSubmit={handleCoupon} className="pt-3 border-t border-[#F0F0F0] space-y-2">
              <label className="text-xs font-semibold text-[#595959] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#B11116]" />
                کد تخفیف دارید؟ (کد نمونه: CAFE10)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="CAFE10"
                  className="flex-1 px-3 py-2 text-xs text-left border border-[#E5E5E5] rounded-lg uppercase"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2.5 bg-[#111111] text-white text-sm font-bold rounded-xl hover:bg-[#B11116] transition-colors cursor-pointer"
                >
                  اعمال
                </button>
              </div>
              {cart.coupon_code && (
                <button
                  type="button"
                  onClick={() => {
                    setCouponInput('');
                    applyCoupon('');
                  }}
                  className="text-xs font-semibold text-[#B11116] hover:underline cursor-pointer"
                >
                  حذف کد تخفیف {cart.coupon_code}
                </button>
              )}
            </form>

            <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
              <span className="text-sm font-bold text-[#111111]">مبلغ قابل پرداخت</span>
              <span className="text-lg font-extrabold text-[#B11116] tabular-nums">
                {formatToman(cart.after_product_discount - cart.coupon_discount_amount)}
              </span>
            </div>

            <AppLink
              to="/checkout"
              onClick={(e) => {
                if (cart.has_unavailable_items) e.preventDefault();
              }}
              className={`w-full min-h-[52px] py-3.5 px-6 bg-[#B11116] text-white text-base font-bold rounded-xl hover:bg-[#8E0D11] transition-colors duration-200 inline-flex items-center justify-center gap-2 ${
                cart.has_unavailable_items ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span>ادامه و ثبت سفارش</span>
              <ArrowLeft className="w-5 h-5" />
            </AppLink>
          </div>
        </aside>
      </div>

      {/* Complementary Suggestions */}
      {cart.complementary_products.length > 0 && (
        <section className="pt-4">
          <h2 className="text-lg font-bold text-[#111111] mb-4">کالاهای مکمل پیشنهادی کنار سبد شما</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cart.complementary_products.map((cp) => (
              <div
                key={cp.id}
                className="group relative bg-white border border-[#E5E5E5] rounded-xl p-3 flex items-center gap-3 hover:border-[#B11116] transition-colors"
              >
                <AppLink to={`/product/${cp.slug}`} className="shrink-0">
                  <img
                    src={resolveMediaUrl(cp.main_image)}
                    alt={cp.title}
                    className="w-16 h-16 rounded-lg object-cover bg-[#F5F5F5]"
                  />
                </AppLink>
                <div className="flex-1 min-w-0">
                  <AppLink
                    to={`/product/${cp.slug}`}
                    className="block text-xs font-bold text-[#111111] group-hover:text-[#B11116] line-clamp-1 transition-colors"
                  >
                    {cp.title}
                  </AppLink>
                  <div className="text-xs text-[#666666] tabular-nums mt-1">
                    {formatToman(cp.discount_price || cp.regular_price)}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      addToCart(cp.id, cp.default_variant_id || 0, cp.min_order_qty || 1, false)
                    }
                    className="mt-2 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#111111] text-white text-xs font-bold hover:bg-[#B11116] transition-colors cursor-pointer"
                  >
                    + افزودن به سبد
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
