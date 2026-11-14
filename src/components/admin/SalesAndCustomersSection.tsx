import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Printer,
  RotateCcw,
  CreditCard,
  Truck,
  Tag,
  Trash2,
  Users,
  X,
  Eye,
} from 'lucide-react';
import {
  apiFetch,
  downloadAuthenticatedFile,
  formatPersianDate,
  formatToman,
  getSessionToken,
  ORDER_STATUS_META,
  toPersianDigits,
} from '../../lib/format';
import { useStore } from '../../context/StoreContext';

interface SalesAndCustomersSectionProps {
  mode: 'orders' | 'payments' | 'shipping' | 'coupons' | 'customers';
  orders: any[];
  customers: any[];
  coupons: any[];
  initialOrderFilter?: string;
  onRefreshAll: () => void;
}

export function SalesAndCustomersSection({
  mode,
  orders,
  customers,
  coupons,
  initialOrderFilter = 'all',
  onRefreshAll,
}: SalesAndCustomersSectionProps) {
  const { notify } = useStore();

  // Orders state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState(initialOrderFilter);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');

  // Authenticated Receipt Preview Modal
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // Payments ledger
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Shipping methods
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [shipForm, setShipForm] = useState({
    id: 0,
    title: '',
    description: '',
    calc_type: 'fixed',
    base_cost: 150000,
    per_kg_cost: 0,
    free_threshold: '',
    estimated_days: '۱ تا ۲ روز کاری',
  });

  // Coupons
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    title: '',
    discount_type: 'percent',
    discount_value: 10,
    min_order_amount: 500000,
    customer_group: 'all',
  });

  // Customers CRM
  const [custSearch, setCustSearch] = useState('');
  const [custGroupFilter, setCustGroupFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [custForm, setCustForm] = useState({
    customer_group: 'regular',
    wholesale_status: 'none',
    credit_limit: 0,
    payment_terms: '',
    internal_notes: '',
  });

  useEffect(() => {
    setOrderFilter(initialOrderFilter);
  }, [initialOrderFilter]);

  const loadPayments = async () => {
    try {
      const res = await apiFetch<{ payments: any[] }>('/api/admin/payments');
      setPayments(res.payments || []);
    } catch {
      // ignore
    }
  };

  const loadShipping = async () => {
    try {
      const res = await apiFetch<{ methods: any[] }>('/api/admin/shipping-methods');
      setShippingMethods(res.methods || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (mode === 'payments') loadPayments();
    if (mode === 'shipping') loadShipping();
  }, [mode]);

  const openReceiptPreview = async (filename: string) => {
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/receipts/${filename}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('دریافت تصویر فیش امکان‌پذیر نیست.');
      const blob = await res.blob();
      setReceiptUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      notify(err.message || 'خطا در باز کردن فیش', 'error');
    }
  };

  const closeReceiptPreview = () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    setReceiptUrl(null);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const isPendingBank =
        o.payment?.method === 'bank_transfer' &&
        o.payment?.status === 'pending' &&
        Boolean(o.payment?.receipt_filename);

      if (orderFilter === 'pending_review' && !isPendingBank && o.status !== 'pending_payment' && o.status !== 'payment_verification') return false;
      if (orderFilter === 'paid' && !['paid', 'processing', 'preparing'].includes(o.status)) return false;
      if (orderFilter === 'shipped' && !['shipped', 'delivered'].includes(o.status)) return false;
      if (orderFilter === 'cancelled' && !['cancelled', 'refunded'].includes(o.status)) return false;

      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        if (!`${o.order_number} ${o.customer_name} ${o.customer_mobile}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, orderFilter, orderSearch]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (custGroupFilter === 'wholesale_pending' && c.wholesale_status !== 'pending') return false;
      if (custGroupFilter === 'wholesale' && c.customer_group !== 'wholesale' && c.wholesale_status !== 'approved') return false;
      if (custGroupFilter === 'vip' && c.customer_group !== 'vip') return false;
      if (custSearch.trim()) {
        const q = custSearch.trim().toLowerCase();
        if (!`${c.name} ${c.cafe_name || ''} ${c.mobile}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [customers, custSearch, custGroupFilter]);

  // ========================
  // MODE 1: ORDERS + INVOICE + CANCEL/REFUND
  // ========================
  if (mode === 'orders') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#111111]">مدیریت سفارشات، فاکتورها و تایید فیش بانکی</h1>
            <p className="text-xs text-[#525252] mt-1">
              مشاهده جزئیات کامل، چاپ صورتحساب رسمی، تایید/رد فیش واریزی، لغو با بازگشت خودکار موجودی و ثبت استرداد وجه
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => downloadAuthenticatedFile('/api/admin/export/orders', 'baristapro-orders.csv').catch((e) => notify(e.message, 'error'))}
              className="min-h-[42px] px-4 py-2 border border-[#E5E5E5] bg-white text-xs font-bold rounded-xl hover:border-[#111111] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>خروجی CSV سفارشات</span>
            </button>
            <div className="relative w-full sm:w-64">
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="جستجوی کد سفارش، نام یا موبایل..."
                className="w-full pr-9 pl-3 py-2.5 text-xs bg-white border border-[#E5E5E5] rounded-xl"
              />
              <Search className="w-4 h-4 text-[#525252] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `همه سفارشات (${toPersianDigits(orders.length)})` },
            { id: 'pending_review', label: 'نیازمند بررسی / پرداخت' },
            { id: 'paid', label: 'پرداخت‌شده و آماده‌سازی' },
            { id: 'shipped', label: 'ارسال‌شده / تحویل‌شده' },
            { id: 'cancelled', label: 'لغو / مستردشده' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setOrderFilter(f.id)}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer whitespace-nowrap ${
                orderFilter === f.id
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#B11116]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm font-bold text-[#111111]">سفارشی مطابق فیلتر انتخابی یافت نشد.</p>
            <button
              type="button"
              onClick={() => {
                setOrderFilter('all');
                setOrderSearch('');
              }}
              className="min-h-[40px] px-5 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              نمایش همه سفارشات
            </button>
          </div>
        ) : (
          filteredOrders.map((o) => {
            const st = ORDER_STATUS_META[o.status] || { label: o.status, tone: 'bg-stone-100' };
            const isPendingBankReview =
              o.payment?.method === 'bank_transfer' &&
              o.payment?.status === 'pending' &&
              o.payment?.receipt_filename;

            return (
              <div key={o.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm tabular-nums text-[#111111]">{o.order_number}</strong>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#111111]">
                        {o.customer_name} ({o.customer_mobile})
                      </span>
                    </div>
                    <div className="text-[#525252]">
                      {o.shipping_method_title} · مبلغ نهایی:{' '}
                      <strong className="text-[#B11116] tabular-nums">{formatToman(o.total_payable)}</strong>
                      {o.refunded_amount > 0 && (
                        <span className="text-[#B11116] font-bold"> · مستردشده: {formatToman(o.refunded_amount)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailOrder(o);
                        setCancelReason('');
                        setRefundAmount(String(o.total_payable));
                        setRefundNote('');
                      }}
                      className="min-h-[38px] px-4 py-1.5 border border-[#111111] text-[#111111] text-xs font-bold rounded-xl hover:bg-[#111111] hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>جزئیات و فاکتور</span>
                    </button>
                    <span className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${st.tone}`}>
                      {st.label}
                    </span>
                  </div>
                </div>

                {o.payment?.method === 'bank_transfer' && (
                  <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>فیش کارت‌به‌کارت:</strong> کد پیگیری{' '}
                        <span className="tabular-nums font-bold">{o.payment.reference_id || 'ثبت نشده'}</span>
                        {o.payment.card_last4 && ` · ۴ رقم آخر: ${o.payment.card_last4}`}
                      </div>
                      {o.payment.receipt_filename && (
                        <button
                          type="button"
                          onClick={() => openReceiptPreview(o.payment.receipt_filename)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-[#B11116]/30 bg-white text-[#B11116] font-bold hover:bg-[#B11116] hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده تصویر فیش</span>
                        </button>
                      )}
                    </div>

                    {isPendingBankReview && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#E5E5E5]">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/payments/${o.payment.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({ approve: true }),
                            });
                            notify(`فیش سفارش ${o.order_number} تایید شد`);
                            onRefreshAll();
                          }}
                          className="min-h-[42px] px-4 py-2 bg-[#1E6B4B] text-white text-xs font-bold rounded-xl hover:bg-[#165339] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تایید پرداخت فیش</span>
                        </button>
                        <input
                          type="text"
                          value={rejectReasons[o.id] || ''}
                          onChange={(e) => setRejectReasons({ ...rejectReasons, [o.id]: e.target.value })}
                          placeholder="دلیل رد فیش..."
                          className="min-h-[42px] px-3.5 py-2 bg-white border border-[#E5E5E5] rounded-xl flex-1 min-w-[180px]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/payments/${o.payment.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({
                                approve: false,
                                rejection_reason: rejectReasons[o.id] || '',
                              }),
                            });
                            notify('فیش رد شد و رزرو کالا آزاد گردید', 'info');
                            setRejectReasons({ ...rejectReasons, [o.id]: '' });
                            onRefreshAll();
                          }}
                          className="min-h-[42px] px-4 py-2 bg-[#B11116] text-white text-xs font-bold rounded-xl hover:bg-[#8E0D11] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>رد فیش</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <select
                    value={o.status}
                    onChange={async (e) => {
                      await apiFetch(`/api/admin/orders/${o.id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      notify('وضعیت سفارش بروزرسانی شد');
                      onRefreshAll();
                    }}
                    className="min-h-[42px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl bg-white font-semibold"
                  >
                    {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={trackingInputs[o.id] ?? o.tracking_code ?? ''}
                    onChange={(e) => setTrackingInputs({ ...trackingInputs, [o.id]: e.target.value })}
                    placeholder="کد رهگیری پیک / باربری..."
                    className="min-h-[42px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl flex-1 min-w-[180px]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/orders/${o.id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ tracking_code: trackingInputs[o.id] ?? o.tracking_code }),
                      });
                      notify('کد رهگیری ذخیره شد');
                      onRefreshAll();
                    }}
                    className="min-h-[42px] px-5 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#B11116] cursor-pointer"
                  >
                    ثبت کد رهگیری
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Order Detail + Printable Invoice + Cancel/Refund Modal */}
        {detailOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
            <div
              className="bg-white w-full max-w-3xl rounded-2xl p-6 lg:p-8 space-y-5 max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#111111]">صورتحساب رسمی فروش باریستاپرو</h2>
                  <p className="text-xs text-[#525252] tabular-nums">
                    شماره سفارش: {detailOrder.order_number} · تاریخ: {formatPersianDate(detailOrder.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[40px] px-4 py-2 bg-[#B11116] text-white text-xs font-bold rounded-xl hover:bg-[#111111] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>چاپ فاکتور</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailOrder(null)}
                    className="min-h-[40px] px-4 py-2 border border-[#111111] text-[#111111] text-xs font-bold rounded-xl cursor-pointer"
                  >
                    بستن
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#FAFAFA] p-4 rounded-xl border border-[#E5E5E5]">
                <div className="space-y-1">
                  <div>خریدار: <strong>{detailOrder.customer_name}</strong></div>
                  <div className="tabular-nums">موبایل: {detailOrder.customer_mobile}</div>
                  <div>روش ارسال: {detailOrder.shipping_method_title}</div>
                </div>
                <div className="space-y-1">
                  <div>
                    نشانی تحویل:{' '}
                    {detailOrder.shipping_address_snapshot?.province}، {detailOrder.shipping_address_snapshot?.city} —{' '}
                    {detailOrder.shipping_address_snapshot?.full_address}
                  </div>
                  <div className="tabular-nums">کد رهگیری: {detailOrder.tracking_code || 'ثبت نشده'}</div>
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-[#E5E5E5]">
                <thead>
                  <tr className="bg-[#FAFAFA]">
                    <th className="border border-[#E5E5E5] p-2.5 text-right">شرح کالا</th>
                    <th className="border border-[#E5E5E5] p-2.5">تعداد</th>
                    <th className="border border-[#E5E5E5] p-2.5">فی</th>
                    <th className="border border-[#E5E5E5] p-2.5">جمع ردیف</th>
                  </tr>
                </thead>
                <tbody>
                  {detailOrder.items?.map((it: any) => (
                    <tr key={it.id}>
                      <td className="border border-[#E5E5E5] p-2.5 font-semibold">
                        {it.product_title} ({it.variant_title}) — <span className="tabular-nums text-[#525252]">{it.sku}</span>
                      </td>
                      <td className="border border-[#E5E5E5] p-2.5 text-center tabular-nums">{toPersianDigits(it.quantity)}</td>
                      <td className="border border-[#E5E5E5] p-2.5 text-center tabular-nums">{formatToman(it.unit_price)}</td>
                      <td className="border border-[#E5E5E5] p-2.5 text-center tabular-nums font-bold">{formatToman(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-2">
                <div className="space-y-1 text-[#525252] tabular-nums">
                  <div>جمع اقلام: {formatToman(detailOrder.subtotal_amount)}</div>
                  <div>هزینه ارسال: {formatToman(detailOrder.shipping_fee)}</div>
                  {detailOrder.coupon_discount_amount > 0 && (
                    <div className="text-[#1E6B4B]">تخفیف کد ({detailOrder.coupon_code}): -{formatToman(detailOrder.coupon_discount_amount)}</div>
                  )}
                </div>
                <div className="text-base font-extrabold text-[#B11116] tabular-nums">
                  مبلغ نهایی: {formatToman(detailOrder.total_payable)}
                </div>
              </div>

              {/* Admin Cancel & Refund Controls */}
              <div className="pt-4 border-t border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs no-print">
                {detailOrder.status !== 'cancelled' && detailOrder.status !== 'refunded' && (
                  <div className="p-4 rounded-xl border border-[#B11116]/30 bg-[#FDF2F2]/40 space-y-2.5">
                    <div className="font-extrabold text-[#B11116]">لغو سفارش + بازگشت خودکار موجودی به انبار</div>
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="علت لغو سفارش..."
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/orders/${detailOrder.id}/cancel`, {
                            method: 'POST',
                            body: JSON.stringify({ reason: cancelReason || 'لغو توسط مدیر سیستم' }),
                          });
                          notify('سفارش لغو شد و موجودی کالا به انبار بازگشت');
                          setDetailOrder(null);
                          onRefreshAll();
                        } catch (err: any) {
                          notify(err.message, 'error');
                        }
                      }}
                      className="w-full min-h-[38px] bg-[#B11116] text-white font-bold rounded-lg hover:bg-[#111111] cursor-pointer"
                    >
                      لغو قطعی و بازگشت موجودی
                    </button>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] space-y-2.5">
                  <div className="font-extrabold text-[#111111] flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-[#B11116]" />
                    <span>ثبت استرداد وجه (کامل یا جزئی)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="مبلغ استرداد (تومان)"
                      className="w-1/2 px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg tabular-nums"
                    />
                    <input
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                      placeholder="شماره پیگیری عودت..."
                      className="w-1/2 px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/admin/orders/${detailOrder.id}/refund`, {
                          method: 'POST',
                          body: JSON.stringify({ amount: Number(refundAmount), note: refundNote }),
                        });
                        notify('استرداد وجه در پرونده سفارش ثبت شد');
                        setDetailOrder(null);
                        onRefreshAll();
                      } catch (err: any) {
                        notify(err.message, 'error');
                      }
                    }}
                    className="w-full min-h-[38px] bg-[#111111] text-white font-bold rounded-lg hover:bg-[#B11116] cursor-pointer"
                  >
                    ثبت سند استرداد وجه
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Authenticated Receipt Image Preview Modal */}
        {receiptUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={closeReceiptPreview}>
            <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-3 bg-[#111111] text-white flex items-center justify-between">
                <span className="text-sm font-bold">تصویر فیش واریزی بانکی</span>
                <button type="button" onClick={closeReceiptPreview} className="p-1 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-[#F5F5F5] flex justify-center max-h-[75vh] overflow-auto">
                <img src={receiptUrl} alt="فیش واریزی" className="max-w-full rounded-xl object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // MODE 2: PAYMENTS LEDGER
  // ========================
  if (mode === 'payments') {
    const filteredPayments = payments.filter((p) => {
      if (paymentFilter === 'pending' && p.status !== 'pending') return false;
      if (paymentFilter === 'verified' && p.status !== 'verified') return false;
      if (paymentFilter === 'rejected' && p.status !== 'rejected') return false;
      return true;
    });

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#B11116]" />
            <span>دفتر کل تراکنش‌های پرداخت و فیش‌های بانکی</span>
          </h1>
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'همه' },
              { id: 'pending', label: 'در انتظار تایید' },
              { id: 'verified', label: 'تاییدشده' },
              { id: 'rejected', label: 'ردشده' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPaymentFilter(t.id)}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  paymentFilter === t.id ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-[#525252] border-[#E5E5E5]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-x-auto p-4">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-[#525252]">
                <th className="py-3">سفارش</th>
                <th className="py-3">مشتری</th>
                <th className="py-3">روش</th>
                <th className="py-3">مبلغ</th>
                <th className="py-3">کد پیگیری</th>
                <th className="py-3">وضعیت</th>
                <th className="py-3">فیش / عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 font-bold tabular-nums">{p.order_number}</td>
                  <td className="py-3">{p.customer_name}</td>
                  <td className="py-3">{p.method === 'online_gateway' ? 'درگاه آنلاین' : 'کارت‌به‌کارت'}</td>
                  <td className="py-3 font-bold text-[#B11116] tabular-nums">{formatToman(p.amount)}</td>
                  <td className="py-3 tabular-nums">{p.reference_id || '—'}</td>
                  <td className="py-3 font-bold">
                    {p.status === 'verified' ? (
                      <span className="text-[#1E6B4B]">تاییدشده</span>
                    ) : p.status === 'rejected' ? (
                      <span className="text-[#B11116]">ردشده</span>
                    ) : (
                      <span className="text-amber-700">در انتظار</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {p.receipt_filename && (
                        <button
                          type="button"
                          onClick={() => openReceiptPreview(p.receipt_filename)}
                          className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold hover:border-[#111111] cursor-pointer"
                        >
                          تصویر فیش
                        </button>
                      )}
                      {p.status === 'pending' && p.method === 'bank_transfer' && p.receipt_filename && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/payments/${p.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({ approve: true }),
                            });
                            notify('پرداخت تایید شد');
                            loadPayments();
                            onRefreshAll();
                          }}
                          className="px-3 py-1.5 bg-[#1E6B4B] text-white rounded-lg font-bold cursor-pointer"
                        >
                          تایید سریع
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {receiptUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={closeReceiptPreview}>
            <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-3 bg-[#111111] text-white flex items-center justify-between">
                <span className="text-sm font-bold">تصویر فیش واریزی</span>
                <button type="button" onClick={closeReceiptPreview} className="p-1 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-[#F5F5F5] flex justify-center max-h-[75vh] overflow-auto">
                <img src={receiptUrl} alt="فیش" className="max-w-full rounded-xl" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // MODE 3: SHIPPING METHODS
  // ========================
  if (mode === 'shipping') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#B11116]" />
          <span>مدیریت روش‌های ارسال و تعرفه باربری</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (shipForm.id) {
                  await apiFetch(`/api/admin/shipping-methods/${shipForm.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      ...shipForm,
                      free_threshold: shipForm.free_threshold ? Number(shipForm.free_threshold) : null,
                    }),
                  });
                  notify('روش ارسال بروزرسانی شد');
                } else {
                  await apiFetch('/api/admin/shipping-methods', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...shipForm,
                      free_threshold: shipForm.free_threshold ? Number(shipForm.free_threshold) : null,
                    }),
                  });
                  notify('روش ارسال جدید ایجاد شد');
                }
                setShipForm({ id: 0, title: '', description: '', calc_type: 'fixed', base_cost: 150000, per_kg_cost: 0, free_threshold: '', estimated_days: '۱ تا ۲ روز کاری' });
                loadShipping();
              } catch (err: any) {
                notify(err.message, 'error');
              }
            }}
            className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3 text-xs"
          >
            <h2 className="text-sm font-extrabold text-[#111111]">{shipForm.id ? 'ویرایش روش ارسال' : 'افزودن روش ارسال'}</h2>
            <input
              required
              value={shipForm.title}
              onChange={(e) => setShipForm({ ...shipForm, title: e.target.value })}
              placeholder="عنوان روش (مثلاً پیک تخصصی کافه‌های تهران)"
              className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
            />
            <input
              value={shipForm.description}
              onChange={(e) => setShipForm({ ...shipForm, description: e.target.value })}
              placeholder="توضیحات کوتاه..."
              className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={shipForm.calc_type}
                onChange={(e) => setShipForm({ ...shipForm, calc_type: e.target.value })}
                className="px-3 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
              >
                <option value="fixed">نرخ ثابت</option>
                <option value="weight_based">بر اساس وزن (کیلوگرم)</option>
                <option value="free_above">رایگان بالای سقف خرید</option>
              </select>
              <input
                value={shipForm.estimated_days}
                onChange={(e) => setShipForm({ ...shipForm, estimated_days: e.target.value })}
                placeholder="زمان تحویل"
                className="px-3 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <input
                type="number"
                value={shipForm.base_cost}
                onChange={(e) => setShipForm({ ...shipForm, base_cost: Number(e.target.value) })}
                placeholder="هزینه پایه (تومان)"
                className="px-3 py-2.5 border border-[#E5E5E5] rounded-xl tabular-nums"
              />
              <input
                type="number"
                value={shipForm.per_kg_cost}
                onChange={(e) => setShipForm({ ...shipForm, per_kg_cost: Number(e.target.value) })}
                placeholder="به ازای هر کیلوگرم"
                className="px-3 py-2.5 border border-[#E5E5E5] rounded-xl tabular-nums"
              />
            </div>
            <input
              type="number"
              value={shipForm.free_threshold}
              onChange={(e) => setShipForm({ ...shipForm, free_threshold: e.target.value })}
              placeholder="سقف ارسال رایگان (تومان - اختیاری)"
              className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl tabular-nums"
            />
            <button type="submit" className="w-full min-h-[44px] bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] cursor-pointer">
              {shipForm.id ? 'ذخیره تغییرات' : 'ایجاد روش ارسال'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl divide-y divide-[#F0F0F0]">
            {shippingMethods.map((m) => (
              <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-extrabold text-[#111111]">{m.title} {!m.is_active && '[غیرفعال]'}</div>
                  <div className="text-[#525252] tabular-nums">
                    پایه: {formatToman(m.base_cost)} · هر کیلو: {formatToman(m.per_kg_cost)} · زمان: {m.estimated_days}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShipForm({
                        id: m.id,
                        title: m.title,
                        description: m.description || '',
                        calc_type: m.calc_type,
                        base_cost: m.base_cost,
                        per_kg_cost: m.per_kg_cost,
                        free_threshold: m.free_threshold ? String(m.free_threshold) : '',
                        estimated_days: m.estimated_days || '',
                      })
                    }
                    className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold cursor-pointer"
                  >
                    ویرایش
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/shipping-methods/${m.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ is_active: m.is_active ? 0 : 1 }),
                      });
                      loadShipping();
                    }}
                    className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold cursor-pointer"
                  >
                    {m.is_active ? 'غیرفعال کن' : 'فعال کن'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // MODE 4: COUPONS
  // ========================
  if (mode === 'coupons') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-5">
        <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
          <Tag className="w-5 h-5 text-[#B11116]" />
          <span>مدیریت کدهای تخفیف و کمپین‌های کافه‌ای</span>
        </h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiFetch('/api/admin/coupons', { method: 'POST', body: JSON.stringify(newCoupon) });
              setNewCoupon({ code: '', title: '', discount_type: 'percent', discount_value: 10, min_order_amount: 500000, customer_group: 'all' });
              notify('کد تخفیف ایجاد شد');
              onRefreshAll();
            } catch (err: any) {
              notify(err.message, 'error');
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs"
        >
          <input
            required
            dir="ltr"
            value={newCoupon.code}
            onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
            placeholder="CODE"
            className="min-h-[44px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl uppercase text-left"
          />
          <input
            required
            value={newCoupon.title}
            onChange={(e) => setNewCoupon({ ...newCoupon, title: e.target.value })}
            placeholder="عنوان کمپین"
            className="min-h-[44px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl"
          />
          <select
            value={newCoupon.discount_type}
            onChange={(e) => setNewCoupon({ ...newCoupon, discount_type: e.target.value })}
            className="min-h-[44px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl bg-white"
          >
            <option value="percent">درصدی (٪)</option>
            <option value="fixed">مبلغ ثابت (تومان)</option>
          </select>
          <input
            required
            type="number"
            value={newCoupon.discount_value}
            onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: Number(e.target.value) })}
            placeholder="مقدار"
            className="min-h-[44px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl tabular-nums"
          />
          <select
            value={newCoupon.customer_group}
            onChange={(e) => setNewCoupon({ ...newCoupon, customer_group: e.target.value })}
            className="min-h-[44px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl bg-white"
          >
            <option value="all">همه مشتریان</option>
            <option value="wholesale">فقط همکاران عمده</option>
            <option value="vip">فقط مشتریان VIP</option>
          </select>
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
          >
            ایجاد کوپن
          </button>
        </form>

        <div className="divide-y divide-[#F0F0F0] text-xs">
          {coupons.map((cp) => (
            <div key={cp.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <strong dir="ltr" className="text-sm text-[#111111]">{cp.code}</strong> — {cp.title} (
                <span className="tabular-nums font-bold text-[#B11116]">
                  {cp.discount_type === 'percent' ? `${toPersianDigits(cp.discount_value)}٪` : formatToman(cp.discount_value)}
                </span>
                )
              </div>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/admin/coupons/${cp.id}`, { method: 'DELETE' });
                  notify('کوپن حذف شد');
                  onRefreshAll();
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#B11116]/30 text-[#B11116] font-bold hover:bg-[#B11116] hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ========================
  // MODE 5: CUSTOMERS CRM & WHOLESALE B2B
  // ========================
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B11116]" />
            <span>باشگاه مشتریان کافه‌دار و تایید حساب‌های عمده (B2B)</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadAuthenticatedFile('/api/admin/export/customers', 'baristapro-customers.csv').catch((e) => notify(e.message, 'error'))}
            className="min-h-[42px] px-4 py-2 border border-[#E5E5E5] bg-white text-xs font-bold rounded-xl hover:border-[#111111] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>خروجی CSV مشتریان</span>
          </button>
          <div className="relative w-full sm:w-64">
            <input
              type="search"
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              placeholder="نام، کافه یا موبایل..."
              className="w-full pr-9 pl-3 py-2.5 text-xs bg-white border border-[#E5E5E5] rounded-xl"
            />
            <Search className="w-4 h-4 text-[#525252] absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'همه مشتریان' },
          { id: 'wholesale_pending', label: 'درخواست عمده در انتظار تایید' },
          { id: 'wholesale', label: 'همکاران عمده (B2B)' },
          { id: 'vip', label: 'مشتریان VIP' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setCustGroupFilter(f.id)}
            className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
              custGroupFilter === f.id ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-[#525252] border-[#E5E5E5]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead>
            <tr className="border-b border-[#E5E5E5] text-[#525252]">
              <th className="py-3">نام / مجموعه</th>
              <th className="py-3">موبایل</th>
              <th className="py-3">گروه / عمده‌فروشی</th>
              <th className="py-3">تعداد سفارش</th>
              <th className="py-3">جمع خرید</th>
              <th className="py-3">مدیریت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {filteredCustomers.map((c) => (
              <tr key={c.id}>
                <td className="py-3.5 font-semibold text-[#111111]">
                  {c.name} {c.cafe_name && <span className="text-[#525252]">({c.cafe_name})</span>}
                </td>
                <td className="py-3.5 tabular-nums">{c.mobile}</td>
                <td className="py-3.5">
                  <span className="font-bold text-[#111111]">
                    {c.customer_group === 'wholesale' ? 'همکار عمده' : c.customer_group === 'vip' ? 'VIP' : 'عادی'}
                  </span>
                  {c.wholesale_status === 'pending' && (
                    <span className="text-[#B11116] font-extrabold"> · منتظر تایید B2B</span>
                  )}
                </td>
                <td className="py-3.5 tabular-nums">{toPersianDigits(c.orders_count)}</td>
                <td className="py-3.5 tabular-nums font-bold">{formatToman(c.total_spent)}</td>
                <td className="py-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await apiFetch<{ customer: any; addresses: any[]; orders: any[] }>(`/api/admin/customers/${c.id}`);
                        setSelectedCustomer(res);
                        setCustForm({
                          customer_group: res.customer.customer_group || 'regular',
                          wholesale_status: res.customer.wholesale_status || 'none',
                          credit_limit: res.customer.credit_limit || 0,
                          payment_terms: res.customer.payment_terms || '',
                          internal_notes: res.customer.internal_notes || '',
                        });
                      }}
                      className="px-3 py-1.5 bg-[#111111] text-white rounded-lg font-bold hover:bg-[#B11116] cursor-pointer"
                    >
                      پرونده و B2B
                    </button>
                    {c.role === 'customer' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/customers/${c.id}/status`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: c.status === 'active' ? 'blocked' : 'active' }),
                          });
                          onRefreshAll();
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${
                          c.status === 'active' ? 'border-emerald-200 text-[#1E6B4B]' : 'border-[#B11116] text-[#B11116]'
                        }`}
                      >
                        {c.status === 'active' ? 'فعال' : 'مسدود'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer Detail & Wholesale Approval Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#111111]">{selectedCustomer.customer.name}</h2>
                <div className="text-[#525252] tabular-nums">
                  {selectedCustomer.customer.mobile} · {selectedCustomer.customer.cafe_name || 'بدون نام کافه'}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="p-1.5 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">گروه مشتری</label>
                <select
                  value={custForm.customer_group}
                  onChange={(e) => setCustForm({ ...custForm, customer_group: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white"
                >
                  <option value="regular">عادی</option>
                  <option value="wholesale">همکار عمده B2B</option>
                  <option value="vip">مشتری ویژه VIP</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">وضعیت همکاری عمده‌فروشی</label>
                <select
                  value={custForm.wholesale_status}
                  onChange={(e) => setCustForm({ ...custForm, wholesale_status: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white"
                >
                  <option value="none">بدون درخواست</option>
                  <option value="pending">در انتظار بررسی</option>
                  <option value="approved">تاییدشده (فعال‌سازی قیمت عمده)</option>
                  <option value="rejected">ردشده</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">سقف اعتبار خرید (تومان)</label>
                <input
                  type="number"
                  value={custForm.credit_limit}
                  onChange={(e) => setCustForm({ ...custForm, credit_limit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">شرایط تسویه (مثلاً نقدی / چک ۱۵ روزه)</label>
                <input
                  value={custForm.payment_terms}
                  onChange={(e) => setCustForm({ ...custForm, payment_terms: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">یادداشت داخلی مدیران درباره این مشتری</label>
              <textarea
                rows={2}
                value={custForm.internal_notes}
                onChange={(e) => setCustForm({ ...custForm, internal_notes: e.target.value })}
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl"
              />
            </div>

            <button
              type="button"
              onClick={async () => {
                await apiFetch(`/api/admin/customers/${selectedCustomer.customer.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(custForm),
                });
                notify('تغییرات حساب مشتری و وضعیت B2B ذخیره شد');
                setSelectedCustomer(null);
                onRefreshAll();
              }}
              className="w-full min-h-[44px] bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] cursor-pointer"
            >
              ذخیره وضعیت مشتری و سطح عمده‌فروشی
            </button>

            <div className="pt-3 border-t border-[#F0F0F0] space-y-2">
              <div className="font-bold text-[#111111]">تاریخچه سفارش‌های مشتری ({toPersianDigits(selectedCustomer.orders.length)})</div>
              {selectedCustomer.orders.map((ord: any) => (
                <div key={ord.id} className="flex justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-[#F0F0F0]">
                  <span className="tabular-nums font-bold">{ord.order_number}</span>
                  <span>{ORDER_STATUS_META[ord.status]?.label || ord.status}</span>
                  <span className="tabular-nums font-bold text-[#B11116]">{formatToman(ord.total_payable)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
