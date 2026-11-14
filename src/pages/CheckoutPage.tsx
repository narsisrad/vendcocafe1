import React, { useEffect, useState } from 'react';
import { CheckCircle2, Truck, CreditCard, Landmark, ArrowLeft, ShieldCheck } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatToman, toPersianDigits } from '../lib/format';
import { Address, ShippingMethod } from '../types';

export function CheckoutPage() {
  const { user, cart, refreshCart, navigate, notify } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerMobile, setCustomerMobile] = useState(user?.mobile || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [province, setProvince] = useState('تهران');
  const [city, setCity] = useState('تهران');
  const [postalCode, setPostalCode] = useState('');
  const [fullAddress, setFullAddress] = useState('');

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'online_gateway' | 'bank_transfer'>('online_gateway');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setCustomerName(user.name);
      setCustomerMobile(user.mobile);
      setCustomerEmail(user.email || '');
      apiFetch<{ addresses: Address[] }>('/api/customer/addresses')
        .then((res) => {
          setSavedAddresses(res.addresses);
          const def = res.addresses.find((a) => a.is_default) || res.addresses[0];
          if (def) {
            setProvince(def.province);
            setCity(def.city);
            setPostalCode(def.postal_code);
            setFullAddress(def.full_address);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    apiFetch<{ methods: ShippingMethod[] }>('/api/shipping-methods').then((res) => {
      setShippingMethods(res.methods);
      if (res.methods[0]) {
        setSelectedShippingId(res.methods[0].id);
        refreshCart(res.methods[0].id);
      }
    });
  }, [refreshCart]);

  const handleSelectShipping = async (id: number) => {
    setSelectedShippingId(id);
    await refreshCart(id);
  };

  const handleSubmitOrder = async () => {
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        order_number: string;
        payment_method: string;
        authority_token: string;
      }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: customerName,
          customer_mobile: customerMobile,
          customer_email: customerEmail,
          shipping_address: {
            receiver_name: customerName,
            receiver_mobile: customerMobile,
            province,
            city,
            postal_code: postalCode,
            full_address: fullAddress,
          },
          shipping_method_id: selectedShippingId,
          payment_method: paymentMethod,
        }),
      });
      await refreshCart();
      notify(`سفارش ${res.order_number} با موفقیت ثبت شد`);
      navigate(`/payment/${res.order_number}`);
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#1A1A1A] mb-3">سبد خرید برای تسویه‌حساب خالی است</h1>
        <AppLink
          to="/products"
          className="inline-flex items-center justify-center min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors"
        >
          بازگشت به فروشگاه
        </AppLink>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-[#111111]">تکمیل خرید و تسویه‌حساب</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          {[
            { num: 1, label: 'اطلاعات و آدرس' },
            { num: 2, label: 'روش ارسال' },
            { num: 3, label: 'شیوه پرداخت' },
            { num: 4, label: 'بازبینی نهایی' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as any)}
              className={`min-h-[42px] px-4 py-2 rounded-xl font-semibold cursor-pointer transition-colors ${
                step === s.num
                  ? 'bg-[#111111] text-white'
                  : step > s.num
                  ? 'bg-[#FDF2F2] text-[#B11116] border border-[#F2D6D7]'
                  : 'bg-white border border-[#E5E5E5] text-[#525252] hover:border-[#111111] hover:text-[#111111]'
              }`}
            >
              {toPersianDigits(s.num)}. {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-white border border-[#EBEBEB] rounded-2xl p-6 lg:p-8 space-y-6">
          {/* Step 1: Customer & Address */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#1A1A1A]">۱. اطلاعات تحویل‌گیرنده و نشانی</h2>

              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#595959]">انتخاب از آدرس‌های ذخیره‌شده:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setCustomerName(addr.receiver_name);
                          setCustomerMobile(addr.receiver_mobile);
                          setProvince(addr.province);
                          setCity(addr.city);
                          setPostalCode(addr.postal_code);
                          setFullAddress(addr.full_address);
                        }}
                        className="p-3 text-right rounded-xl border border-[#EBEBEB] hover:border-[#B11116] bg-[#FDF2F2]/40 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-bold text-[#1A1A1A]">{addr.title}</div>
                        <div className="text-[11px] text-[#595959] mt-1 line-clamp-2">{addr.full_address}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">نام و نام خانوادگی تحویل‌گیرنده *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">شماره موبایل هماهنگی *</label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-left border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">استان *</label>
                  <input
                    type="text"
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">شهر *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">کد پستی (۱۰ رقمی)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-left border border-[#E5E5E5] rounded-lg tabular-nums focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">ایمیل دریافت فاکتور (اختیاری)</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-left border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#595959] mb-1">نشانی دقیق پستی (خیابان، پلاک، نام کافه) *</label>
                <textarea
                  rows={2}
                  required
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!customerName.trim() || !customerMobile.trim() || !fullAddress.trim()) {
                    notify('لطفاً نام، موبایل و نشانی کامل را تکمیل نمایید.', 'error');
                    return;
                  }
                  setStep(2);
                }}
                className="min-h-[50px] px-7 py-3 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تایید و انتخاب روش ارسال</span>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Shipping Method */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#B11116]" />
                ۲. انتخاب شیوه ارسال سفارش
              </h2>

              <div className="space-y-3">
                {shippingMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                      selectedShippingId === m.id
                        ? 'border-[#B11116] bg-[#FDF2F2]'
                        : 'border-[#EBEBEB] hover:bg-[#FDF2F2]/40 hover:border-[#B11116]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="shipping_method"
                          checked={selectedShippingId === m.id}
                          onChange={() => handleSelectShipping(m.id)}
                          className="mt-1 accent-[#B11116]"
                        />
                        <div>
                          <div className="text-sm font-bold text-[#1A1A1A]">{m.title}</div>
                          <div className="text-xs text-[#595959] mt-1">{m.description}</div>
                          <div className="text-[11px] text-[#B11116] mt-1 font-medium">زمان تحویل: {m.estimated_days}</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#B11116] tabular-nums shrink-0">
                        {m.base_cost === 0 ? 'رایگان' : formatToman(m.base_cost)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep(1)} className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E5E5E5] text-sm font-semibold text-[#111111] hover:border-[#111111] cursor-pointer transition-colors">
                  بازگشت به مرحله قبل
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[50px] px-7 py-3 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>تایید و انتخاب روش پرداخت</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment Method */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#111111]">۳. انتخاب روش پرداخت</h2>

              <div className="space-y-3">
                <label
                  className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                    paymentMethod === 'online_gateway'
                      ? 'border-[#B11116] bg-[#FDF2F2]'
                      : 'border-[#E5E5E5] hover:border-[#B11116]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment_method"
                      checked={paymentMethod === 'online_gateway'}
                      onChange={() => setPaymentMethod('online_gateway')}
                      className="accent-[#B11116]"
                    />
                    <CreditCard className="w-5 h-5 text-[#B11116]" />
                    <div>
                      <div className="text-sm font-bold text-[#111111]">پرداخت آنلاین با کلیه کارت‌های شتاب</div>
                      <div className="text-xs text-[#595959] mt-0.5">
                        تایید آنی پرداخت و رزرو قطعی موجودی کالا از طریق آداپتور امن درگاه بانکی
                      </div>
                    </div>
                  </div>
                </label>

                <label
                  className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-[#B11116] bg-[#FDF2F2]'
                      : 'border-[#E5E5E5] hover:border-[#B11116]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment_method"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={() => setPaymentMethod('bank_transfer')}
                      className="accent-[#B11116]"
                    />
                    <Landmark className="w-5 h-5 text-[#B11116]" />
                    <div>
                      <div className="text-sm font-bold text-[#111111]">کارت‌به‌کارت / حواله بانکی (ارسال فیش واریزی)</div>
                      <div className="text-xs text-[#595959] mt-0.5">
                        مناسب سفارش‌های عمده بالای سقف کارت؛ بررسی و تایید فیش توسط واحد مالی
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep(2)} className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E5E5E5] text-sm font-semibold text-[#111111] hover:border-[#111111] cursor-pointer transition-colors">
                  بازگشت به روش ارسال
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="min-h-[50px] px-7 py-3 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>بازبینی نهایی فاکتور</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Final Review & Submit */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#B11116]" />
                ۴. بازبینی نهایی و ثبت سفارش
              </h2>

              <div className="p-4 rounded-xl bg-[#FDF2F2]/50 border border-[#F2D6D7] space-y-2 text-xs">
                <div><span className="text-[#595959]">تحویل‌گیرنده:</span> <strong className="text-[#1A1A1A]">{customerName}</strong> ({customerMobile})</div>
                <div><span className="text-[#595959]">نشانی:</span> {province}، {city}، {fullAddress}</div>
                <div><span className="text-[#595959]">روش ارسال:</span> {cart.shipping_method?.title}</div>
                <div><span className="text-[#595959]">شیوه پرداخت:</span> {paymentMethod === 'online_gateway' ? 'درگاه پرداخت آنلاین' : 'کارت‌به‌کارت بانکی'}</div>
              </div>

              <div className="divide-y divide-[#F0F0F0] border border-[#EBEBEB] rounded-xl">
                {cart.items.map((i) => (
                  <div key={i.item_id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1A1A1A]">{i.product_title}</span>
                      <span className="text-[#595959] mr-2">({i.variant_title}) × {toPersianDigits(i.quantity)}</span>
                    </div>
                    <strong className="tabular-nums text-[#B11116]">{formatToman(i.line_total)}</strong>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button type="button" onClick={() => setStep(3)} className="min-h-[46px] px-5 py-2.5 rounded-xl border border-[#E5E5E5] text-sm font-semibold text-[#111111] hover:border-[#111111] cursor-pointer transition-colors">
                  تغییر روش پرداخت
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitOrder}
                  className="min-h-[52px] px-8 py-3.5 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#111111] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'در حال ثبت تراکنشی سفارش...' : 'ثبت قطعی سفارش و انتقال به پرداخت'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Box */}
        <aside className="lg:col-span-4 bg-white border border-[#F2D6D7] rounded-2xl p-6 space-y-4 sticky top-24">
          <h3 className="text-base font-bold text-[#1A1A1A] pb-3 border-b border-[#F2D6D7]">
            جزئیات محاسبه سرور
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-[#595959]">
              <span>جمع کالاها</span>
              <span className="tabular-nums">{formatToman(cart.subtotal_regular)}</span>
            </div>
            {cart.product_discount_amount > 0 && (
              <div className="flex justify-between text-[#B11116]">
                <span>تخفیف کالاها</span>
                <span className="tabular-nums">− {formatToman(cart.product_discount_amount)}</span>
              </div>
            )}
            {cart.coupon_discount_amount > 0 && (
              <div className="flex justify-between text-[#B11116]">
                <span>کوپن ({cart.coupon_code})</span>
                <span className="tabular-nums">− {formatToman(cart.coupon_discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#595959]">
              <span>هزینه ارسال</span>
              <span className="tabular-nums">
                {cart.shipping_fee === 0 ? 'رایگان' : formatToman(cart.shipping_fee)}
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-[#F2D6D7] flex justify-between items-center">
            <span className="font-bold text-sm text-[#1A1A1A]">مبلغ نهایی قابل پرداخت</span>
            <span className="text-lg font-extrabold text-[#B11116] tabular-nums">
              {formatToman(cart.total_payable)}
            </span>
          </div>
          <div className="text-[11px] text-[#595959] flex items-center gap-1.5 pt-2">
            <ShieldCheck className="w-4 h-4 text-[#B11116] shrink-0" />
            <span>کلیه مبالغ و موجودی کالا با قفل تراکنشی سرور محاسبه می‌شوند.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
