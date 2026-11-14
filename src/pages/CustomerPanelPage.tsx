import React, { useEffect, useState } from 'react';
import { Package, MapPin, Heart, Bell, Printer, CheckCircle2, Clock } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatPersianDate, formatToman, ORDER_STATUS_META, toPersianDigits } from '../lib/format';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { Address, Product } from '../types';

export function CustomerPanelPage() {
  const { user, setAuthModalOpen, notify } = useStore();
  const [tab, setTab] = useState<'orders' | 'addresses' | 'wishlist' | 'notifications'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [invoiceOrder, setInvoiceOrder] = useState<any | null>(null);

  // Add address state
  const [addrTitle, setAddrTitle] = useState('');
  const [addrProvince, setAddrProvince] = useState('تهران');
  const [addrCity, setAddrCity] = useState('تهران');
  const [addrPostal, setAddrPostal] = useState('');
  const [addrFull, setAddrFull] = useState('');

  // Wholesale application state
  const [cafeNameInput, setCafeNameInput] = useState(user?.cafe_name || '');
  const [businessIdInput, setBusinessIdInput] = useState('');
  const [wholesaleSubmitting, setWholesaleSubmitting] = useState(false);

  const loadData = async () => {
    if (!user) return;
    const [o, a, w, n] = await Promise.all([
      apiFetch<{ orders: any[] }>('/api/customer/orders'),
      apiFetch<{ addresses: Address[] }>('/api/customer/addresses'),
      apiFetch<{ items: Product[] }>('/api/customer/wishlist'),
      apiFetch<{ notifications: any[] }>('/api/customer/notifications'),
    ]);
    setOrders(o.orders);
    setAddresses(a.addresses);
    setWishlist(w.items);
    setNotifications(n.notifications);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-[#1A1A1A] mb-3">برای مشاهده پنل کاربری وارد شوید</h1>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
        >
          ورود به حساب کاربری
        </button>
      </div>
    );
  }

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/customer/addresses', {
        method: 'POST',
        body: JSON.stringify({
          title: addrTitle,
          receiver_name: user.name,
          receiver_mobile: user.mobile,
          province: addrProvince,
          city: addrCity,
          postal_code: addrPostal,
          full_address: addrFull,
          is_default: addresses.length === 0,
        }),
      });
      setAddrTitle('');
      setAddrFull('');
      setAddrPostal('');
      notify('آدرس جدید ذخیره شد');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleWholesaleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setWholesaleSubmitting(true);
    try {
      await apiFetch('/api/customer/wholesale-apply', {
        method: 'POST',
        body: JSON.stringify({
          cafe_name: cafeNameInput,
          business_id: businessIdInput,
        }),
      });
      notify('درخواست حساب همکاری عمده‌فروشی ثبت و به تیم فروش ارسال شد.');
      loadData();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setWholesaleSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 bg-white border border-[#EBEBEB] rounded-2xl p-5 space-y-4 no-print">
          <div className="pb-4 border-b border-[#F0F0F0]">
            <div className="text-base font-bold text-[#1A1A1A]">{user.name}</div>
            <div className="text-xs text-[#595959] mt-1 tabular-nums">{user.mobile}</div>
            {user.cafe_name && <div className="text-xs text-[#B11116] font-medium mt-1">{user.cafe_name}</div>}
            <div className="text-[11px] font-bold text-[#111111] mt-2">
              نوع حساب:{' '}
              {user.wholesale_status === 'approved' || user.customer_group === 'wholesale'
                ? 'همکار عمده B2B (فعال)'
                : user.wholesale_status === 'pending'
                ? 'درخواست عمده در حال بررسی'
                : 'مشتری عادی'}
            </div>
          </div>
          <nav className="space-y-1">
            {[
              { id: 'orders', label: 'سفارش‌ها و پیگیری', icon: Package },
              { id: 'addresses', label: 'مدیریت آدرس‌ها', icon: MapPin },
              { id: 'wishlist', label: 'لیست علاقه‌مندی‌ها', icon: Heart },
              { id: 'notifications', label: 'اعلان‌ها و پیام‌ها', icon: Bell },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as any)}
                  className={`w-full min-h-[46px] px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer transition-colors ${
                    tab === item.id
                      ? 'bg-[#111111] text-white'
                      : 'text-[#525252] hover:bg-[#FDF2F2] hover:text-[#B11116]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {user.role === 'customer' && user.wholesale_status !== 'approved' && (
            <form onSubmit={handleWholesaleApply} className="pt-4 border-t border-[#F0F0F0] space-y-2.5 text-xs">
              <div className="font-extrabold text-[#111111]">درخواست همکاری عمده (B2B)</div>
              <p className="text-[11px] text-[#525252] leading-relaxed">
                کافه‌داران و رستری‌ها پس از تایید مدیر، قیمت عمده محصولات را مشاهده می‌کنند.
              </p>
              <input
                type="text"
                required
                value={cafeNameInput}
                onChange={(e) => setCafeNameInput(e.target.value)}
                placeholder="نام کافه یا مجموعه"
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl"
              />
              <input
                type="text"
                dir="ltr"
                value={businessIdInput}
                onChange={(e) => setBusinessIdInput(e.target.value)}
                placeholder="شناسه صنفی / ملی (اختیاری)"
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl text-left"
              />
              <button
                type="submit"
                disabled={wholesaleSubmitting || user.wholesale_status === 'pending'}
                className="w-full min-h-[40px] px-4 py-2 bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {user.wholesale_status === 'pending'
                  ? 'در انتظار تایید مدیریت'
                  : wholesaleSubmitting
                  ? 'در حال ارسال...'
                  : 'ثبت درخواست حساب عمده'}
              </button>
            </form>
          )}
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {tab === 'orders' && (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-[#111111]">تاریخچه و پیگیری سفارش‌ها</h1>
              {orders.length === 0 ? (
                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-10 text-center text-sm text-[#595959]">
                  هنوز سفارشی ثبت نکرده‌اید.
                </div>
              ) : (
                orders.map((o) => {
                  const statusMeta = ORDER_STATUS_META[o.status] || { label: o.status, tone: 'bg-neutral-100 text-neutral-700' };
                  return (
                    <div key={o.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
                        <div className="flex items-center gap-3 text-xs">
                          <strong className="text-sm text-[#111111] tabular-nums">{o.order_number}</strong>
                          <span className="text-[#595959]">·</span>
                          <span className="text-[#595959]">{formatPersianDate(o.created_at)}</span>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-lg border ${statusMeta.tone}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {o.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-xs">
                            <span>
                              {item.product_title} ({item.variant_title}) × {toPersianDigits(item.quantity)}
                            </span>
                            <span className="font-semibold tabular-nums">{formatToman(item.line_total)}</span>
                          </div>
                        ))}
                      </div>

                      {o.tracking_code && (
                        <div className="p-2.5 bg-[#FAFAFA] rounded-lg text-xs text-[#1E6B4B] font-medium">
                          کد رهگیری مرسوله پستی/پیک: <strong className="tabular-nums">{o.tracking_code}</strong>
                        </div>
                      )}

                      {o.payment?.rejection_reason && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                          علت رد فیش بانکی: {o.payment.rejection_reason}
                        </div>
                      )}

                      <div className="pt-3 border-t border-[#F0F0F0] flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-bold text-[#B11116] tabular-nums">
                          مبلغ کل: {formatToman(o.total_payable)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          {o.status === 'pending_payment' && (
                            <AppLink
                              to={`/payment/${o.order_number}`}
                              className="min-h-[42px] px-5 py-2.5 bg-[#B11116] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#8E0D11] transition-colors inline-flex items-center justify-center"
                            >
                              تکمیل پرداخت / ارسال فیش
                            </AppLink>
                          )}
                          <button
                            type="button"
                            onClick={() => setInvoiceOrder(o)}
                            className="min-h-[42px] px-5 py-2.5 border border-[#111111] text-[#111111] text-xs sm:text-sm font-bold rounded-xl hover:bg-[#111111] hover:text-white transition-colors inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                            مشاهده و چاپ فاکتور
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'addresses' && (
            <div className="space-y-5">
              <h1 className="text-xl font-extrabold text-[#111111]">دفترچه آدرس‌های تحویل</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((a) => (
                  <div key={a.id} className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <strong className="text-sm text-[#111111]">{a.title}</strong>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/customer/addresses/${a.id}`, { method: 'DELETE' });
                          loadData();
                        }}
                        className="text-xs text-[#B11116] hover:underline cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                    <p className="text-xs text-[#595959]">{a.province}، {a.city} — {a.full_address}</p>
                    <p className="text-[11px] text-[#8C8C8C] tabular-nums">کدپستی: {a.postal_code || '—'}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddAddress} className="bg-white border border-[#E5E5E5] rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-[#111111]">افزودن نشانی شعبه جدید</h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input required value={addrTitle} onChange={(e) => setAddrTitle(e.target.value)} placeholder="عنوان (مثلاً شعبه نیاوران)" className="px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]" />
                  <input required value={addrProvince} onChange={(e) => setAddrProvince(e.target.value)} placeholder="استان" className="px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]" />
                  <input required value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="شهر" className="px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]" />
                  <input value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} placeholder="کد پستی" className="px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]" />
                </div>
                <input required value={addrFull} onChange={(e) => setAddrFull(e.target.value)} placeholder="آدرس دقیق پستی" className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]" />
                <button type="submit" className="min-h-[46px] px-6 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer">
                  ذخیره آدرس جدید
                </button>
              </form>
            </div>
          )}

          {tab === 'wishlist' && (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-[#1A1A1A]">کالاهای مورد علاقه</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {wishlist.map((w) => (
                  <AppLink
                    key={w.id}
                    to={`/product/${w.slug}`}
                    className="group block bg-white border border-[#EBEBEB] hover:border-[#B11116] rounded-xl p-4 space-y-3 transition-all"
                  >
                    <div className="overflow-hidden rounded-lg bg-[#F8F8F8]">
                      <img src={resolveMediaUrl(w.main_image)} alt={w.title} className="w-full aspect-[4/3] object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                    </div>
                    <div className="text-sm font-bold text-[#1A1A1A] group-hover:text-[#B11116] text-right transition-colors">
                      {w.title}
                    </div>
                    <div className="text-xs font-bold text-[#B11116] tabular-nums">{formatToman(w.discount_price || w.regular_price)}</div>
                  </AppLink>
                ))}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-3">
              <h1 className="text-xl font-extrabold text-[#111111]">اعلان‌ها و وضعیت سفارش</h1>
              {notifications.map((n) => (
                <div key={n.id} className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#1E6B4B] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-[#111111]">{n.title}</div>
                    <p className="text-xs text-[#595959] mt-1">{n.body}</p>
                    <span className="text-[11px] text-[#8C8C8C] mt-1 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatPersianDate(n.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Printable Invoice Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 lg:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#111111]">صورتحساب رسمی فروش باریستاپرو</h2>
                <p className="text-xs text-[#595959] tabular-nums">شماره سفارش: {invoiceOrder.order_number}</p>
              </div>
              <div className="flex gap-2.5 no-print">
                <button type="button" onClick={() => window.print()} className="min-h-[42px] px-5 py-2 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer">
                  چاپ فاکتور
                </button>
                <button type="button" onClick={() => setInvoiceOrder(null)} className="min-h-[42px] px-5 py-2 border border-[#111111] text-[#111111] text-sm font-bold rounded-xl hover:bg-[#111111] hover:text-white transition-colors cursor-pointer">
                  بستن
                </button>
              </div>
            </div>
            <div className="text-xs space-y-1">
              <div>خریدار: <strong>{invoiceOrder.customer_name}</strong> — {invoiceOrder.customer_mobile}</div>
              <div>نشانی تحویل: {invoiceOrder.shipping_address_snapshot?.province}، {invoiceOrder.shipping_address_snapshot?.city}، {invoiceOrder.shipping_address_snapshot?.full_address}</div>
            </div>
            <table className="w-full text-xs border-collapse border border-[#EBEBEB]">
              <thead>
                <tr className="bg-[#FDF2F2]/60">
                  <th className="border border-[#EBEBEB] p-2 text-right">شرح کالا</th>
                  <th className="border border-[#EBEBEB] p-2">تعداد</th>
                  <th className="border border-[#EBEBEB] p-2">فی</th>
                  <th className="border border-[#EBEBEB] p-2">جمع کل</th>
                </tr>
              </thead>
              <tbody>
                {invoiceOrder.items?.map((it: any) => (
                  <tr key={it.id}>
                    <td className="border border-[#EBEBEB] p-2">{it.product_title} ({it.variant_title})</td>
                    <td className="border border-[#EBEBEB] p-2 text-center tabular-nums">{toPersianDigits(it.quantity)}</td>
                    <td className="border border-[#EBEBEB] p-2 text-center tabular-nums">{formatToman(it.unit_price)}</td>
                    <td className="border border-[#EBEBEB] p-2 text-center tabular-nums font-bold">{formatToman(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm font-extrabold text-left text-[#B11116] tabular-nums">
              مبلغ نهایی پرداختی: {formatToman(invoiceOrder.total_payable)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
