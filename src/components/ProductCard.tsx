import React from 'react';
import { ShoppingBag, ArrowUpLeft } from 'lucide-react';
import { Product } from '../types';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { formatToman, toPersianDigits } from '../lib/format';
import { useStore } from '../context/StoreContext';
import { AppLink } from './AppLink';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const imgUrl = resolveMediaUrl(product.main_image);
  const price = product.effective_price ?? product.discount_price ?? product.regular_price ?? 0;
  const regular = product.regular_price ?? price;
  const discountPct =
    product.discount_percent ??
    (regular > price && regular > 0 ? Math.round(((regular - price) / regular) * 100) : 0);
  const availableStock = product.available_stock ?? 0;
  const variantId = product.default_variant_id ?? 0;
  const productUrl = `/product/${product.slug}`;

  return (
    <article className="group relative bg-white border border-[#EBEBEB] rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B11116] hover:shadow-md">
      <div className="relative aspect-[4/3] w-full bg-[#F8F8F8] overflow-hidden">
        <img
          src={imgUrl}
          alt={product.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {discountPct > 0 && (
          <span className="absolute top-3 right-3 bg-[#B11116] text-white text-xs font-bold px-2.5 py-1 rounded-md tabular-nums">
            {toPersianDigits(discountPct)}٪ تخفیف
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#666666] mb-1.5 truncate">
            <span>{product.brand_name || 'باریستاپرو'}</span>
            <span aria-hidden="true">·</span>
            <span>{product.unit_label_fa}</span>
            {product.order_step_qty > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span>ضریب {toPersianDigits(product.order_step_qty)}</span>
              </>
            )}
          </div>

          <AppLink
            to={productUrl}
            className="block text-right w-full text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2 group-hover:text-[#B11116] transition-colors after:absolute after:inset-0 focus:outline-none"
          >
            <span className="inline-flex items-start justify-between gap-1 w-full">
              <span>{product.title}</span>
              <ArrowUpLeft className="w-4 h-4 shrink-0 text-[#B11116] opacity-0 group-hover:opacity-100 transition-all mt-0.5" />
            </span>
          </AppLink>
        </div>

        <div className="pt-3 border-t border-[#F2F2F2] flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {product.is_wholesale_price && (
              <span className="text-[11px] font-bold text-[#111111] mb-0.5">قیمت عمده همکار</span>
            )}
            {regular > price && (
              <span className="text-xs text-[#8C8C8C] line-through tabular-nums">
                {formatToman(regular)}
              </span>
            )}
            <span className="text-[15px] font-bold text-[#B11116] tabular-nums">
              {formatToman(price)}
            </span>
          </div>

          {availableStock > 0 && variantId > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product.id, variantId, product.min_order_qty || 1, true);
              }}
              className="relative z-10 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-bold hover:bg-[#B11116] transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={`افزودن ${product.title} به سبد خرید`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>افزودن</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#B11116] whitespace-nowrap">ناموجود</span>
          )}
        </div>
      </div>
    </article>
  );
}
