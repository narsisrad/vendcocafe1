import React from 'react';
import {
  AlertTriangle,
  Download,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Package,
  CreditCard,
  ImageOff,
  Search,
  Building2,
} from 'lucide-react';
import {
  downloadAuthenticatedFile,
  formatPersianDate,
  formatToman,
  ORDER_STATUS_META,
  toPersianDigits,
} from '../../lib/format';
import { resolveMediaUrl } from '../../lib/mediaRegistry';
import { useStore } from '../../context/StoreContext';

interface DashboardOverviewProps {
  dash: any;
  range: string;
  onRangeChange: (r: string) => void;
  onRefresh: () => void;
  onNavigateTab: (tab: string, subFilter?: string) => void;
}

export function DashboardOverview({
  dash,
  range,
  onRangeChange,
  onRefresh,
  onNavigateTab,
}: DashboardOverviewProps) {
  const { notify } = useStore();

  if (!dash) return null;

  const {
    stats,
    low_stock_variants = [],
    recent_orders = [],
    recent_logs = [],
    daily_chart = [],
    order_status_breakdown = [],
    payment_method_breakdown = [],
    top_products = [],
  } = dash;

  const maxRevenue = Math.max(1, ...daily_chart.map((d: any) => Number(d.revenue) || 0));

  const handleExport = async (type: 'orders' | 'products' | 'customers' | 'inventory') => {
    try {
      await downloadAuthenticatedFile(`/api/admin/export/${type}`, `baristapro-${type}.csv`);
      notify('فایل گزارش CSV با موفقیت دانلود شد');
    } catch (err: any) {
      notify(err.message || 'خطا در دانلود گزارش', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Date Filter + Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#111111]">داشبورد جامع مدیریت و هوش تجاری</h1>
          <p className="text-xs text-[#525252] mt-1">
            نمای زنده فروش، وضعیت مالی، موجودی انبار و هشدارهای عملیاتی باریستاپرو
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-[#E5E5E5] rounded-xl bg-white p-1 gap-1">
            {[
              { id: 'today', label: 'امروز' },
              { id: '7d', label: '۷ روز اخیر' },
              { id: '30d', label: '۳۰ روز اخیر' },
              { id: 'all', label: 'کل دوره' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRangeChange(r.id)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  range === r.id ? 'bg-[#111111] text-white' : 'text-[#525252] hover:text-[#B11116]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleExport('orders')}
            className="min-h-[42px] px-4 py-2 text-xs font-bold border border-[#E5E5E5] bg-white text-[#111111] rounded-xl hover:border-[#111111] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>خروجی CSV سفارشات</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#111111] text-white rounded-xl hover:bg-[#B11116] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            <span>بروزرسانی</span>
          </button>
        </div>
      </div>

      {/* 6 Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
          <div className="text-xs text-[#525252] font-medium">درآمد تاییدشده دوره</div>
          <div className="text-lg font-extrabold text-[#111111] tabular-nums">
            {formatToman(stats.total_revenue)}
          </div>
          <div className="text-[11px] text-[#525252] tabular-nums">
            فروش امروز: {formatToman(stats.today_revenue)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
          <div className="text-xs text-[#525252] font-medium">سفارش‌های کل / موفق</div>
          <div className="text-lg font-extrabold text-[#1E6B4B] tabular-nums">
            {toPersianDigits(stats.total_orders)} / {toPersianDigits(stats.paid_orders)}
          </div>
          <div className="text-[11px] text-[#525252] tabular-nums">
            در انتظار بررسی: {toPersianDigits(stats.pending_orders)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
          <div className="text-xs text-[#525252] font-medium">فیش نیازمند تایید</div>
          <div className="text-lg font-extrabold text-[#B11116] tabular-nums">
            {toPersianDigits(stats.pending_receipts)} فیش
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders', 'pending_review')}
            className="text-[11px] font-bold text-[#B11116] hover:underline cursor-pointer"
          >
            بررسی فوری فیش‌ها ←
          </button>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
          <div className="text-xs text-[#525252] font-medium">ارزش موجودی انبار</div>
          <div className="text-lg font-extrabold text-[#111111] tabular-nums">
            {formatToman(stats.total_inventory_value)}
          </div>
          <div className="text-[11px] text-[#525252] tabular-nums">
            {toPersianDigits(stats.total_inventory_units)} واحد کالا
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
          <div className="text-xs text-[#525252] font-medium">محصولات و وضعیت انبار</div>
          <div className="text-lg font-extrabold text-[#111111] tabular-nums">
            {toPersianDigits(stats.active_products)} از {toPersianDigits(stats.total_products)}
          </div>
          <div className="text-[11px] text-[#B11116] tabular-nums">
            ناموجود: {toPersianDigits(stats.out_of_stock_count)} · کم: {toPersianDigits(stats.low_stock_count)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
          <div className="text-xs text-[#525252] font-medium">مشتریان و کافه‌ها</div>
          <div className="text-lg font-extrabold text-[#111111] tabular-nums">
            {toPersianDigits(stats.total_customers)} مشتری
          </div>
          <div className="text-[11px] text-[#525252] tabular-nums">
            درخواست عمده: {toPersianDigits(stats.wholesale_pending)}
          </div>
        </div>
      </div>

      {/* Actionable Operational Alerts Strip */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#111111] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B11116]" />
            <span>هشدارهای هوشمند عملیاتی و چک‌لیست فروشگاه</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigateTab('orders', 'pending_review')}
            className="p-3.5 rounded-xl border border-[#E5E5E5] hover:border-[#B11116] text-right transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between font-bold text-[#111111]">
              <span>فیش‌های در انتظار</span>
              <CreditCard className="w-4 h-4 text-[#B11116]" />
            </div>
            <div className="text-base font-extrabold text-[#B11116] tabular-nums">
              {toPersianDigits(stats.pending_receipts)} مورد
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="p-3.5 rounded-xl border border-[#E5E5E5] hover:border-[#B11116] text-right transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between font-bold text-[#111111]">
              <span>کسری / اتمام موجودی</span>
              <Package className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-base font-extrabold text-amber-700 tabular-nums">
              {toPersianDigits(stats.low_stock_count + stats.out_of_stock_count)} تنوع
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('customers')}
            className="p-3.5 rounded-xl border border-[#E5E5E5] hover:border-[#B11116] text-right transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between font-bold text-[#111111]">
              <span>درخواست حساب عمده B2B</span>
              <Building2 className="w-4 h-4 text-[#111111]" />
            </div>
            <div className="text-base font-extrabold text-[#111111] tabular-nums">
              {toPersianDigits(stats.wholesale_pending)} کافه
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('products')}
            className="p-3.5 rounded-xl border border-[#E5E5E5] hover:border-[#B11116] text-right transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between font-bold text-[#111111]">
              <span>محصول بدون تصویر</span>
              <ImageOff className="w-4 h-4 text-[#525252]" />
            </div>
            <div className="text-base font-extrabold text-[#111111] tabular-nums">
              {toPersianDigits(stats.missing_image_count)} کالا
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('seo')}
            className="p-3.5 rounded-xl border border-[#E5E5E5] hover:border-[#B11116] text-right transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between font-bold text-[#111111]">
              <span>صفحات نیازمند سئو</span>
              <Search className="w-4 h-4 text-[#111111]" />
            </div>
            <div className="text-base font-extrabold text-[#111111] tabular-nums">
              {toPersianDigits(stats.missing_seo_count)} صفحه
            </div>
          </button>
        </div>
      </div>

      {/* Revenue Chart + Status & Payment Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#B11116]" />
              <span>روند فروش روزانه (۱۴ روز اخیر)</span>
            </h2>
            <span className="text-xs text-[#525252]">تومان</span>
          </div>

          {daily_chart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-[#525252]">
              هنوز تراکنش فروشی در این بازه ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-48 flex items-end gap-2 pt-4 border-b border-[#E5E5E5]">
                {daily_chart.map((d: any) => {
                  const pct = Math.max(6, Math.round(((Number(d.revenue) || 0) / maxRevenue) * 100));
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group min-w-0">
                      <div className="text-[10px] font-bold text-[#111111] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums truncate">
                        {formatToman(d.revenue)}
                      </div>
                      <div className="w-full flex items-end justify-center h-36">
                        <div
                          style={{ height: `${pct}%` }}
                          className="w-full max-w-[34px] bg-[#111111] group-hover:bg-[#B11116] rounded-t-lg transition-colors"
                          title={`${d.day}: ${formatToman(d.revenue)} (${toPersianDigits(d.orders)} سفارش)`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px] text-[#525252] tabular-nums">
                {daily_chart.map((d: any) => (
                  <span key={d.day} className="flex-1 text-center truncate" dir="ltr">
                    {String(d.day).slice(5)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-5">
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-[#111111]">تفکیک وضعیت سفارش‌ها</h2>
            <div className="space-y-2 text-xs">
              {order_status_breakdown.map((row: any) => {
                const meta = ORDER_STATUS_META[row.status] || { label: row.status };
                const pct = stats.total_orders > 0 ? Math.round((row.count / stats.total_orders) * 100) : 0;
                return (
                  <div key={row.status} className="space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>{meta.label}</span>
                      <span className="tabular-nums text-[#525252]">
                        {toPersianDigits(row.count)} سفارش ({toPersianDigits(pct)}٪)
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#B11116]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[#F0F0F0] space-y-2.5">
            <h3 className="text-sm font-extrabold text-[#111111]">تفکیک روش پرداخت</h3>
            <div className="space-y-2 text-xs">
              {payment_method_breakdown.map((pm: any) => (
                <div key={pm.method} className="flex items-center justify-between py-1.5 border-b border-[#F8F8F8] last:border-0">
                  <span className="font-semibold text-[#111111]">
                    {pm.method === 'online_gateway' ? 'درگاه پرداخت آنلاین' : 'انتقال کارت‌به‌کارت بانکی'}
                  </span>
                  <span className="tabular-nums font-bold text-[#B11116]">
                    {formatToman(pm.total)} ({toPersianDigits(pm.count)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111]">پرفروش‌ترین محصولات فروشگاه</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('products')}
              className="text-xs font-bold text-[#B11116] hover:underline cursor-pointer"
            >
              مدیریت کاتالوگ
            </button>
          </div>
          <div className="divide-y divide-[#F0F0F0] text-xs">
            {top_products.map((p: any) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={resolveMediaUrl(p.main_image)}
                    alt={p.title}
                    className="w-10 h-10 rounded-lg object-cover bg-[#F5F5F5] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[#111111] truncate">{p.title}</div>
                    <div className="text-[11px] text-[#525252] tabular-nums">SKU: {p.sku}</div>
                  </div>
                </div>
                <div className="text-left shrink-0 tabular-nums">
                  <div className="font-extrabold text-[#B11116]">{formatToman(p.order_revenue)}</div>
                  <div className="text-[11px] text-[#525252]">
                    {toPersianDigits(p.units_sold || p.sales_count || 0)} فروش
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#B11116]" />
              <span>آخرین سفارش‌های ثبت‌شده</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-bold text-[#B11116] hover:underline cursor-pointer"
            >
              مشاهده همه
            </button>
          </div>
          <div className="divide-y divide-[#F0F0F0] text-xs">
            {recent_orders.map((o: any) => {
              const meta = ORDER_STATUS_META[o.status] || { label: o.status };
              return (
                <div key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[#111111] tabular-nums">
                      {o.order_number} — {o.customer_name}
                    </div>
                    <div className="text-[11px] text-[#525252]">{meta.label}</div>
                  </div>
                  <div className="text-left shrink-0 tabular-nums">
                    <div className="font-extrabold text-[#111111]">{formatToman(o.total_payable)}</div>
                    <div className="text-[11px] text-[#8C8C8C]">{formatPersianDate(o.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Low Stock & Recent Admin Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111]">اقلام دارای کسری یا هشدار موجودی</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="text-xs font-bold text-[#B11116] hover:underline cursor-pointer"
            >
              تعدیل انبار
            </button>
          </div>
          {low_stock_variants.length === 0 ? (
            <p className="text-xs text-[#525252]">موجودی تمام کالاها در وضعیت مناسب است.</p>
          ) : (
            <div className="divide-y divide-[#F0F0F0] text-xs">
              {low_stock_variants.map((v: any) => (
                <div key={v.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111111] truncate">{v.product_title}</div>
                    <div className="text-[#525252] truncate">
                      {v.variant_title} · SKU: {v.sku}
                    </div>
                  </div>
                  <span className="font-bold text-[#B11116] tabular-nums shrink-0">
                    مانده: {toPersianDigits(v.stock_quantity - v.reserved_quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111]">آخرین رویدادهای ممیزی مدیران</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-bold text-[#B11116] hover:underline cursor-pointer"
            >
              گزارش کامل
            </button>
          </div>
          <div className="divide-y divide-[#F0F0F0] text-xs max-h-64 overflow-y-auto">
            {recent_logs.map((l: any) => (
              <div key={l.id} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <span className="font-semibold text-[#111111]">{l.details}</span>
                  <div className="text-[11px] text-[#525252] mt-0.5">{l.user_name || 'سیستم'}</div>
                </div>
                <span className="text-[11px] text-[#8C8C8C] shrink-0 tabular-nums">
                  {formatPersianDate(l.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
