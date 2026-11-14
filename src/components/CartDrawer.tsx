import React from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowLeft, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { formatToman, toPersianDigits } from '../lib/format';
import { AppLink } from './AppLink';

export function CartDrawer() {
  const {
    cart,
    isCartDrawerOpen,
    setCartDrawerOpen,
    updateCartItem,
    removeCartItem,
  } = useStore();

  if (!isCartDrawerOpen) return null;

  const items = cart?.items || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div
        className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-r border-[#E5E5E5]"
        role="dialog"
        aria-label="سبد خرید سریع"
      >
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#B11116]" />
            <h2 className="font-bold text-[#111111]">
              سبد خرید ({toPersianDigits(items.length)} ردیف کالا)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#111111] hover:bg-[#F8F8F8] hover:text-[#B11116] cursor-pointer transition-colors"
            aria-label="بستن سبد خرید"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free shipping progress */}
        {cart && items.length > 0 && (
          <div className="px-5 py-3 bg-[#FDF2F2]/60 border-b border-[#F2D6D7]">
            <div className="flex items-center gap-2 text-xs text-[#1A1A1A] mb-1.5">
              <Truck className="w-4 h-4 text-[#B11116] shrink-0" />
              {cart.free_shipping_remaining === 0 ? (
                <span className="font-semibold text-[#B11116]">
                  تبریک! سفارش شما مشمول ارسال رایگان پیک تهران است.
                </span>
              ) : (
                <span>
                  فقط <strong className="tabular-nums text-[#B11116]">{formatToman(cart.free_shipping_remaining)}</strong> تا ارسال رایگان
                </span>
              )}
            </div>
            <div className="h-1.5 w-full bg-[#F2D6D7] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#B11116] transition-all duration-300"
                style={{ width: `${cart.free_shipping_percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-12 h-12 text-[#B11116]/40 mb-3" />
              <p className="text-base font-semibold text-[#1A1A1A] mb-1">سبد خرید شما خالی است</p>
              <p className="text-sm text-[#595959] mb-5">
                برای تامین دان قهوه، لیوان و تجهیزات بار کافه، به فروشگاه سر بزنید.
              </p>
              <AppLink
                to="/products"
                onClick={() => setCartDrawerOpen(false)}
                className="min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center justify-center"
              >
                مشاهده محصولات فروشگاه
              </AppLink>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.item_id}
                className="flex gap-3 pb-4 border-b border-[#F0F0F0] last:border-none"
              >
                <AppLink
                  to={`/product/${item.product_slug}`}
                  onClick={() => setCartDrawerOpen(false)}
                  className="shrink-0"
                >
                  <img
                    src={resolveMediaUrl(item.main_image)}
                    alt={item.product_title}
                    className="w-20 h-20 rounded-lg object-cover bg-[#F5F5F5]"
                  />
                </AppLink>
                <div className="flex-1 min-w-0">
                  <AppLink
                    to={`/product/${item.product_slug}`}
                    onClick={() => setCartDrawerOpen(false)}
                    className="block text-sm font-semibold text-[#111111] hover:text-[#B11116] text-right line-clamp-1 transition-colors"
                  >
                    {item.product_title}
                  </AppLink>
                  <p className="text-xs text-[#666666] mt-0.5">{item.variant_title}</p>
                  {item.is_low_stock && (
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      موجودی محدود: {toPersianDigits(item.available_stock)} {item.unit_label_fa}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center border border-[#E5E5E5] rounded-xl bg-[#F8F8F8]">
                      <button
                        type="button"
                        onClick={() => updateCartItem(item.item_id, item.quantity + item.order_step_qty)}
                        className="w-10 h-10 flex items-center justify-center text-[#111111] hover:text-[#B11116] cursor-pointer"
                        aria-label="افزایش تعداد"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="px-3 text-sm font-bold tabular-nums">
                        {toPersianDigits(item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity <= item.min_order_qty
                            ? removeCartItem(item.item_id)
                            : updateCartItem(item.item_id, item.quantity - item.order_step_qty)
                        }
                        className="w-10 h-10 flex items-center justify-center text-[#111111] hover:text-[#B11116] cursor-pointer"
                        aria-label="کاهش تعداد"
                      >
                        {item.quantity <= item.min_order_qty ? (
                          <Trash2 className="w-4 h-4 text-[#B11116]" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <span className="text-sm font-bold text-[#111111] tabular-nums">
                      {formatToman(item.line_total)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart && items.length > 0 && (
          <div className="p-5 border-t border-[#E5E5E5] bg-white space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#525252]">مبلغ قابل پرداخت کالاها</span>
              <span className="font-bold text-base text-[#B11116] tabular-nums">
                {formatToman(cart.after_product_discount - cart.coupon_discount_amount)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AppLink
                to="/cart"
                onClick={() => setCartDrawerOpen(false)}
                className="min-h-[48px] py-3 px-4 border border-[#111111] text-[#111111] text-sm font-bold rounded-xl hover:bg-[#111111] hover:text-white transition-colors inline-flex items-center justify-center text-center"
              >
                مشاهده سبد کامل
              </AppLink>
              <AppLink
                to="/checkout"
                onClick={() => setCartDrawerOpen(false)}
                className="min-h-[48px] py-3 px-4 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#8E0D11] transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <span>ادامه تسویه‌حساب</span>
                <ArrowLeft className="w-4 h-4" />
              </AppLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
