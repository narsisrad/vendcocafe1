import React, { useEffect, useState } from 'react';
import { CreditCard, Landmark, CheckCircle2, XCircle, Upload, Clock } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { apiFetch, formatPersianDate, formatToman, ORDER_STATUS_META, toPersianDigits } from '../lib/format';
import { useStore } from '../context/StoreContext';

export function PaymentPage({ orderNumber }: { orderNumber: string }) {
  const { notify } = useStore();
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Bank transfer receipt fields
  const [refId, setRefId] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const loadOrder = async () => {
    try {
      const [orderRes, pubSettings] = await Promise.all([
        apiFetch(`/api/payment/info/${orderNumber}`),
        apiFetch('/api/settings/public'),
      ]);
      setData(orderRes);
      setSettings(pubSettings);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderNumber]);

  const handleGatewayCallback = async (success: boolean) => {
    if (!data?.payment?.authority_token) return;
    setProcessing(true);
    try {
      const res = await apiFetch<{ status: string; reference_id?: string; already_processed?: boolean }>(
        '/api/payment/gateway/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            authority_token: data.payment.authority_token,
            success,
          }),
        }
      );
      if (res.status === 'verified') {
        notify(`پرداخت تایید شد! کد پیگیری: ${res.reference_id}`);
      } else {
        notify('تراکنش پرداخت ناموفق بود و موجودی رزرو آزاد شد.', 'error');
      }
      await loadOrder();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleBankReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile) {
      notify('لطفاً تصویر فیش واریزی را انتخاب کنید.', 'error');
      return;
    }
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('order_number', orderNumber);
      fd.append('reference_id', refId);
      fd.append('card_last4', cardLast4);
      fd.append('receipt', receiptFile);

      await apiFetch('/api/payment/bank-transfer/submit', {
        method: 'POST',
        body: fd,
      });
      notify('فیش واریزی ثبت شد و در انتظار تایید واحد مالی است.');
      await loadOrder();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-64 bg-[#F0F0F0] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#1A1A1A] mb-3">اطلاعات سفارش یافت نشد</h1>
        <AppLink
          to="/"
          className="inline-flex items-center justify-center min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors"
        >
          بازگشت به خانه
        </AppLink>
      </div>
    );
  }

  const { order, payment, items, history } = data;
  const statusMeta = ORDER_STATUS_META[order.status] || { label: order.status, tone: 'bg-neutral-100 text-neutral-700' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white border border-[#EBEBEB] rounded-2xl p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#F0F0F0]">
          <div>
            <div className="text-xs text-[#595959]">شماره سفارش</div>
            <h1 className="text-xl font-extrabold text-[#1A1A1A] tabular-nums mt-0.5">{order.order_number}</h1>
          </div>
          <span className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border ${statusMeta.tone}`}>
            {statusMeta.label}
          </span>
        </div>

        {/* Status-Specific Payment Action */}
        {order.status === 'pending_payment' && order.payment_method === 'online_gateway' && (
          <div className="p-6 rounded-xl bg-[#FDF2F2]/50 border border-[#F2D6D7] space-y-4">
            <div className="flex items-center gap-2.5 text-base font-bold text-[#1A1A1A]">
              <CreditCard className="w-5 h-5 text-[#B11116]" />
              <span>درگاه پرداخت امن شاپرک (آداپتور تایید سرور-به-سرور)</span>
            </div>
            <p className="text-xs text-[#595959] leading-relaxed">
              توکن تراکنش: <code dir="ltr" className="font-mono text-[#1A1A1A]">{payment?.authority_token}</code>
              <br />
              مبلغ قابل پرداخت: <strong className="text-sm text-[#B11116] tabular-nums">{formatToman(order.total_payable)}</strong>
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => handleGatewayCallback(true)}
                className="min-h-[50px] px-7 py-3 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
              >
                تایید پرداخت موفق (شبیه‌ساز شاپرک)
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => handleGatewayCallback(false)}
                className="min-h-[50px] px-6 py-3 border border-[#111111] bg-white text-[#111111] text-sm font-bold rounded-xl hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
              >
                انصراف / خطای تراکنش
              </button>
            </div>
          </div>
        )}

        {order.status === 'pending_payment' && order.payment_method === 'bank_transfer' && (
          <div className="p-6 rounded-xl bg-[#FDF2F2]/50 border border-[#F2D6D7] space-y-5">
            <div className="flex items-center gap-2.5 text-base font-bold text-[#1A1A1A]">
              <Landmark className="w-5 h-5 text-[#B11116]" />
              <span>پرداخت کارت‌به‌کارت / حواله بانکی</span>
            </div>

            {settings && (
              <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-2 text-xs">
                <div>نام بانک: <strong>{settings.bank_name}</strong> — صاحب حساب: <strong>{settings.bank_account_holder}</strong></div>
                <div className="text-sm font-extrabold text-[#B11116] tabular-nums" dir="ltr">
                  {settings.bank_card_number}
                </div>
                <div className="tabular-nums text-[#595959]" dir="ltr">IBAN: {settings.bank_iban}</div>
                <p className="text-[#595959] pt-1">{settings.bank_instructions}</p>
              </div>
            )}

            <form onSubmit={handleBankReceiptSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">کد پیگیری / شماره ارجاع بانکی *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    placeholder="مثلاً 88492011"
                    className="w-full px-3 py-2 text-sm text-left bg-white border border-[#E5E5E5] rounded-lg tabular-nums focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">۴ رقم آخر کارت مبدا</label>
                  <input
                    type="text"
                    maxLength={4}
                    dir="ltr"
                    value={cardLast4}
                    onChange={(e) => setCardLast4(e.target.value)}
                    placeholder="4512"
                    className="w-full px-3 py-2 text-sm text-left bg-white border border-[#E5E5E5] rounded-lg tabular-nums focus:outline-none focus:border-[#B11116]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#595959] mb-1">تصویر فیش واریزی (JPG/PNG/PDF زیر ۲ مگابایت) *</label>
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E5E5] rounded-xl bg-white cursor-pointer hover:border-[#B11116] transition-colors">
                  <Upload className="w-4 h-4 text-[#B11116]" />
                  <span className="text-xs text-[#111111]">
                    {receiptFile ? receiptFile.name : 'انتخاب فایل تصویر فیش بانکی'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full min-h-[52px] py-3.5 bg-[#B11116] text-white text-base font-bold rounded-xl hover:bg-[#111111] transition-colors cursor-pointer"
              >
                {processing ? 'در حال ارسال ایمن فیش...' : 'ثبت فیش واریزی جهت بررسی مالی'}
              </button>
            </form>
          </div>
        )}

        {order.status === 'payment_verification' && (
          <div className="p-5 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-sky-900">
              <div className="font-bold text-sm">فیش واریزی شما ثبت شد و در صف بررسی واحد مالی است</div>
              <div>شماره پیگیری ارسالی: <strong className="tabular-nums">{payment?.reference_id}</strong></div>
              {payment?.receipt_filename && (
                <a
                  href={`/api/receipts/${payment.receipt_filename}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sky-700 underline mt-1"
                >
                  مشاهده تصویر فیش آپلودشده
                </a>
              )}
            </div>
          </div>
        )}

        {(order.status === 'paid' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') && (
          <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#1E6B4B] shrink-0" />
            <div className="space-y-1 text-xs text-emerald-950">
              <div className="font-bold text-sm">پرداخت سفارش تایید شده است</div>
              <div>کد مرجع تراکنش: <strong className="tabular-nums">{payment?.reference_id || 'تاییدشده'}</strong></div>
              <div>مبلغ پرداختی: <strong className="tabular-nums">{formatToman(order.total_payable)}</strong></div>
            </div>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <XCircle className="w-6 h-6 text-rose-700 shrink-0" />
            <div className="space-y-1 text-xs text-rose-900">
              <div className="font-bold text-sm">این سفارش لغو شده است</div>
              {payment?.rejection_reason && <div>دلیل: {payment.rejection_reason}</div>}
            </div>
          </div>
        )}

        {/* Order Items & Timeline */}
        <div className="pt-4 border-t border-[#F0F0F0] space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">اقلام سفارش</h2>
          <div className="divide-y divide-[#F0F0F0] border border-[#E5E5E5] rounded-xl">
            {items.map((it: any) => (
              <div key={it.id} className="p-3 flex justify-between text-xs">
                <span>
                  {it.product_title} ({it.variant_title}) × {toPersianDigits(it.quantity)}
                </span>
                <strong className="tabular-nums">{formatToman(it.line_total)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <h2 className="text-sm font-bold text-[#1A1A1A]">تاریخچه وضعیت سفارش</h2>
          <div className="space-y-2 text-xs">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between bg-[#F8F8F8] px-3 py-2 rounded-lg">
                <span>{h.note}</span>
                <span className="text-[#8C8C8C]">{formatPersianDate(h.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <AppLink
            to="/panel"
            className="min-h-[46px] px-6 py-2.5 border border-[#111111] text-[#111111] text-sm font-bold rounded-xl hover:bg-[#111111] hover:text-white transition-colors inline-flex items-center justify-center"
          >
            رفتن به پنل سفارش‌ها
          </AppLink>
          <AppLink
            to="/products"
            className="min-h-[46px] px-6 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#8E0D11] transition-colors inline-flex items-center justify-center"
          >
            ادامه خرید
          </AppLink>
        </div>
      </div>
    </div>
  );
}
