import React, { useState } from 'react';
import { X, Lock, User as UserIcon } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/format';

export function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, setUser, refreshCart, notify, navigate } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [cafeName, setCafeName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthModalOpen) return null;

  const submitLogin = async (loginMobile: string, loginPass: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: loginMobile, password: loginPass }),
      });
      setUser(data.user);
      await refreshCart();
      setAuthModalOpen(false);
      notify(`خوش آمدید، ${data.user.name}`);
      if (data.user.role === 'admin' || data.user.role === 'manager') {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await submitLogin(mobile, password);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, mobile, email, cafe_name: cafeName, password }),
      });
      setUser(data.user);
      await refreshCart();
      setAuthModalOpen(false);
      notify('ثبت‌نام شما با موفقیت انجام شد و سبد خرید ادغام گردید.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#EBEBEB] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F8F8F8]">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[#B11116]" />
            <h2 className="font-bold text-[#111111]">
              {mode === 'login' ? 'ورود به حساب باریستاپرو' : 'ثبت‌نام خریدار و کافه‌دار'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#111111] hover:bg-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`min-h-[42px] py-2.5 text-sm font-bold rounded-lg cursor-pointer transition-colors ${
                mode === 'login' ? 'bg-[#111111] text-white shadow-sm' : 'text-[#525252] hover:text-[#111111]'
              }`}
            >
              ورود
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`min-h-[42px] py-2.5 text-sm font-bold rounded-lg cursor-pointer transition-colors ${
                mode === 'register' ? 'bg-[#111111] text-white shadow-sm' : 'text-[#525252] hover:text-[#111111]'
              }`}
            >
              ثبت‌نام جدید
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">نام و نام خانوادگی</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثلاً سارا محمدی"
                    className="w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">نام کافی‌شاپ یا مجموعه (اختیاری)</label>
                  <input
                    type="text"
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    placeholder="کافه رست تهران"
                    className="w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#595959] mb-1">شماره موبایل یا ایمیل</label>
              <input
                type="text"
                required
                dir="ltr"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="0912..."
                className="w-full px-3 py-2.5 text-sm text-left border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#595959] mb-1">ایمیل (اختیاری)</label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@cafe.ir"
                  className="w-full px-3 py-2.5 text-sm text-left border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#595959] mb-1">رمز عبور</label>
              <input
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 text-sm text-left border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#B11116]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#8E0D11] transition-colors duration-200 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'در حال پردازش...' : mode === 'login' ? 'ورود به حساب' : 'ایجاد حساب کاربری'}
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-5 pt-4 border-t border-[#E5E5E5]">
              <p className="text-xs text-[#525252] mb-2.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#B11116]" />
                <span>حساب‌های آماده برای بررسی سریع قابلیت‌ها:</span>
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => submitLogin('09121112233', 'Cafe@1405')}
                  className="min-h-[44px] py-2.5 px-3 text-xs sm:text-sm font-semibold border border-[#111111] rounded-xl hover:bg-[#111111] hover:text-white text-[#111111] cursor-pointer transition-colors"
                >
                  ورود مشتری نمونه
                </button>
                <button
                  type="button"
                  onClick={() => submitLogin('09120000001', 'Admin@1405')}
                  className="min-h-[44px] py-2.5 px-3 text-xs sm:text-sm font-semibold border border-[#B11116] bg-[#FDF2F2] rounded-xl hover:bg-[#B11116] hover:text-white text-[#B11116] cursor-pointer transition-colors"
                >
                  ورود مدیر کل + سئو
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
