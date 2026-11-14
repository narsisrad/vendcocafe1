import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingBag,
  User as UserIcon,
  Menu,
  X,
  Coffee,
  ShieldCheck,
  Truck,
  Phone,
  LogOut,
  Settings,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatToman, toPersianDigits } from '../lib/format';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { CartDrawer } from './CartDrawer';
import { AuthModal } from './AuthModal';
import { AppLink } from './AppLink';
import { NavigationItem } from '../types';

interface StoreNavigationPayload {
  header: NavigationItem[];
  mobile_drawer: NavigationItem[];
  footer: NavigationItem[];
  hamburger_bestsellers: Array<{ id: number; title: string; slug: string; main_image: string }>;
  hamburger_show_bestsellers: boolean;
}

const DEFAULT_HEADER_ITEMS: Array<{ label: string; target_url: string }> = [
  { label: 'خانه', target_url: '/' },
  { label: 'محصولات', target_url: '/products' },
  { label: 'آکادمی باریستا', target_url: '/blog' },
  { label: 'سوالات متداول', target_url: '/faq' },
  { label: 'درباره ما', target_url: '/about' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    currentPath,
    navigate,
    user,
    setUser,
    cart,
    setCartDrawerOpen,
    setAuthModalOpen,
    notify,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ products: any[]; categories: any[] }>({
    products: [],
    categories: [],
  });
  const [showSuggest, setShowSuggest] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navData, setNavData] = useState<StoreNavigationPayload | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadNavigation = async () => {
    try {
      const data = await apiFetch<StoreNavigationPayload>('/api/storefront/navigation');
      setNavData(data);
    } catch {
      // keep default fallback links
    }
  };

  useEffect(() => {
    loadNavigation();
    const onUpdate = () => loadNavigation();
    window.addEventListener('bp-navigation-updated', onUpdate);
    return () => window.removeEventListener('bp-navigation-updated', onUpdate);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions({ products: [], categories: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ products: any[]; categories: any[] }>(
          `/api/search/suggest?q=${encodeURIComponent(searchQuery.trim())}`
        );
        setSuggestions(res);
      } catch {
        // ignore
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggest(false);
    setMobileMenuOpen(false);
    navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    notify('از حساب کاربری خارج شدید.', 'info');
    if (currentPath.startsWith('/admin') || currentPath.startsWith('/panel')) {
      navigate('/');
    }
  };

  const cartItemCount = cart?.items?.length || 0;
  const headerLinks = navData && navData.header.length > 0 ? navData.header : DEFAULT_HEADER_ITEMS;
  const mobileDrawerLinks = navData ? navData.mobile_drawer : [];

  const isNavActive = (url: string) => {
    if (url === '/') return currentPath === '/';
    if (url === '/products') {
      return currentPath.startsWith('/products') || currentPath.startsWith('/category') || currentPath.startsWith('/product');
    }
    return currentPath.startsWith(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111111]">
      {/* B2B Executive Black Top Strip with Vendco Red Hairline */}
      <div className="hidden sm:block bg-[#111111] text-white text-xs py-2.5 px-4 border-b-2 border-[#B11116] no-print">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-4">
          <p className="truncate text-white/95 font-medium">
            ارسال رایگان پیک تخصصی تهران برای سفارش‌های بالای ۵ میلیون تومان · تامین مستقیم کافه‌ها و مجموعه‌های تجاری
          </p>
          <div className="flex items-center gap-5 shrink-0 text-white/85">
            <AppLink to="/faq" className="hover:text-white transition-colors whitespace-nowrap">
              راهنمای خرید عمده
            </AppLink>
            <AppLink to="/contact" className="hover:text-[#F87171] transition-colors whitespace-nowrap font-semibold">
              پشتیبانی B2B: ۰۲۱-۸۸۴۵۹۲۱۰
            </AppLink>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E5E5E5] no-print">
        <div className="max-w-[1320px] mx-auto px-4 lg:px-6 h-16 lg:h-[72px] flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Brand Wordmark + Mobile Hamburger Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#111111] border border-[#E5E5E5] hover:border-[#111111] hover:bg-[#F8F8F8] cursor-pointer transition-colors"
              aria-label="منو"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <AppLink
              to="/"
              className="flex items-center gap-2 text-lg lg:text-xl font-extrabold tracking-tight text-[#111111] hover:text-[#B11116] transition-colors whitespace-nowrap shrink-0"
            >
              <Coffee className="w-6 h-6 text-[#B11116]" />
              <span>باریستاپرو</span>
            </AppLink>
          </div>

          {/* Zone 2: Clean Single-Line Top Nav Links (Dynamic from Admin Menu Builder) */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-[#525252] overflow-x-auto">
            {headerLinks.map((item, idx) => (
              <AppLink
                key={`${item.target_url}-${idx}`}
                to={item.target_url}
                className={`hover:text-[#B11116] transition-colors whitespace-nowrap shrink-0 ${
                  isNavActive(item.target_url) ? 'text-[#B11116]' : ''
                }`}
              >
                {item.label}
              </AppLink>
            ))}
          </nav>

          {/* Search Bar */}
          <div ref={searchRef} className="relative flex-1 max-w-md hidden sm:block">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setShowSuggest(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggest(true);
                }}
                placeholder="جستجوی دان قهوه، لیوان، سیروپ یا کد SKU..."
                className="w-full pr-10 pl-4 py-2.5 text-sm bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-[#111111] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </form>

            {showSuggest &&
              (suggestions.products.length > 0 || suggestions.categories.length > 0) && (
                <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-[#EBEBEB] rounded-xl shadow-xl overflow-hidden z-50">
                  {suggestions.categories.length > 0 && (
                    <div className="px-3 py-2 bg-[#FDF2F2] border-b border-[#F2D6D7]">
                      <div className="text-[11px] font-semibold text-[#B11116] mb-1">دسته‌بندی‌ها</div>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.categories.map((c) => (
                          <AppLink
                            key={c.id}
                            to={`/category/${c.slug}`}
                            onClick={() => setShowSuggest(false)}
                            className="text-xs text-[#B11116] hover:underline font-medium"
                          >
                            {c.name}
                          </AppLink>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="divide-y divide-[#F5F5F5]">
                    {suggestions.products.map((p) => (
                      <AppLink
                        key={p.id}
                        to={`/product/${p.slug}`}
                        onClick={() => setShowSuggest(false)}
                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[#FDF2F2] text-right transition-colors"
                      >
                        <img
                          src={resolveMediaUrl(p.main_image)}
                          alt={p.title}
                          className="w-10 h-10 rounded object-cover bg-[#F8F8F8] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#1A1A1A] truncate">{p.title}</div>
                          <div className="text-[11px] text-[#B11116] font-semibold tabular-nums">
                            {formatToman(p.effective_price)}
                          </div>
                        </div>
                      </AppLink>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Zone 3: Admin + Account + Primary Cart Action */}
          <div className="flex items-center gap-2 shrink-0">
            <AppLink
              to="/admin"
              className={`hidden sm:inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                currentPath.startsWith('/admin')
                  ? 'bg-[#B11116] text-white border-[#B11116]'
                  : 'bg-[#111111] text-white border-[#111111] hover:bg-[#B11116] hover:border-[#B11116]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>پنل مدیریت</span>
            </AppLink>

            {user ? (
              <div className="flex items-center gap-2">
                <AppLink
                  to="/panel"
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl border border-[#111111]/25 text-[#111111] hover:border-[#111111] hover:bg-[#111111] hover:text-white transition-colors whitespace-nowrap"
                >
                  <UserIcon className="w-4 h-4 shrink-0" />
                  <span className="max-w-[90px] truncate">{user.name}</span>
                </AppLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#525252] hover:text-[#B11116] rounded-xl hover:bg-[#FDF2F2] cursor-pointer transition-colors"
                  title="خروج از حساب"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span>ورود / ثبت‌نام</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-bold rounded-xl bg-[#B11116] text-white hover:bg-[#111111] transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">سبد خرید</span>
              {cartItemCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-extrabold rounded-md bg-white text-[#B11116] tabular-nums">
                  {toPersianDigits(cartItemCount)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Top Navigation Strip (Vendco-style Top Bar, Always at Top) */}
        <nav
          aria-label="نوار ناوبری بالای صفحه"
          className="lg:hidden border-t border-[#F0F0F0] bg-white px-4 py-2 overflow-x-auto no-print"
        >
          <div className="flex items-center gap-2 min-w-max">
            {headerLinks.map((item, idx) => (
              <AppLink
                key={`${item.target_url}-${idx}`}
                to={item.target_url}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center transition-colors ${
                  isNavActive(item.target_url)
                    ? 'bg-[#B11116] text-white'
                    : 'bg-[#F8F8F8] text-[#111111] hover:bg-[#111111] hover:text-white'
                }`}
              >
                {item.label}
              </AppLink>
            ))}
            <AppLink
              to="/contact"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center transition-colors ${
                currentPath === '/contact'
                  ? 'bg-[#B11116] text-white'
                  : 'bg-[#F8F8F8] text-[#111111] hover:bg-[#111111] hover:text-white'
              }`}
            >
              تماس با ما
            </AppLink>
            <AppLink
              to="/admin"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
                currentPath.startsWith('/admin')
                  ? 'bg-[#B11116] text-white'
                  : 'bg-[#111111] text-white hover:bg-[#B11116]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>پنل مدیریت</span>
            </AppLink>
          </div>
        </nav>

        {/* Mobile Hamburger Drawer Nav (Dynamic Items + Admin Product Links + Optional Bestsellers) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E5E5E5] bg-white px-4 py-4 space-y-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در محصولات..."
                className="w-full pr-10 pl-4 py-3 text-sm bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#111111]"
              />
              <Search className="w-4 h-4 text-[#111111] absolute right-3.5 top-1/2 -translate-y-1/2" />
            </form>

            <div className="flex flex-col gap-1 text-sm font-semibold">
              {mobileDrawerLinks.length > 0 ? (
                mobileDrawerLinks.map((item) => (
                  <AppLink
                    key={item.id}
                    to={item.target_url}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between min-h-[44px] px-3 rounded-xl transition-colors ${
                      isNavActive(item.target_url)
                        ? 'bg-[#FDF2F2] text-[#B11116] font-bold'
                        : 'text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.link_type === 'product' && (
                      <span className="text-[11px] font-bold text-[#B11116] shrink-0">محصول</span>
                    )}
                    {item.link_type === 'category' && (
                      <span className="text-[11px] font-medium text-[#525252] shrink-0">دسته</span>
                    )}
                  </AppLink>
                ))
              ) : (
                <>
                  <AppLink to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center min-h-[44px] px-3 rounded-xl text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]">خانه</AppLink>
                  <AppLink to="/products" onClick={() => setMobileMenuOpen(false)} className="flex items-center min-h-[44px] px-3 rounded-xl text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]">فروشگاه محصولات</AppLink>
                  <AppLink to="/blog" onClick={() => setMobileMenuOpen(false)} className="flex items-center min-h-[44px] px-3 rounded-xl text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]">آکادمی باریستا</AppLink>
                  <AppLink to="/faq" onClick={() => setMobileMenuOpen(false)} className="flex items-center min-h-[44px] px-3 rounded-xl text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]">سوالات متداول</AppLink>
                  <AppLink to="/about" onClick={() => setMobileMenuOpen(false)} className="flex items-center min-h-[44px] px-3 rounded-xl text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]">درباره ما</AppLink>
                </>
              )}

              <AppLink
                to="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center min-h-[44px] px-3 rounded-xl text-[#111111] hover:bg-[#FDF2F2] hover:text-[#B11116]"
              >
                سبد خرید
              </AppLink>
              <AppLink
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-white bg-[#111111] hover:bg-[#B11116] mt-1"
              >
                <Settings className="w-4 h-4" />
                <span>پنل مدیریت و سئو</span>
              </AppLink>
            </div>

            {/* Auto Bestsellers Section in Hamburger Menu */}
            {navData?.hamburger_show_bestsellers && navData.hamburger_bestsellers.length > 0 && (
              <div className="pt-3 border-t border-[#F0F0F0] space-y-2">
                <div className="text-xs font-extrabold text-[#111111] px-1">پرفروش‌ترین محصولات</div>
                <div className="space-y-1.5">
                  {navData.hamburger_bestsellers.map((prod) => (
                    <AppLink
                      key={prod.id}
                      to={`/product/${prod.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2 rounded-xl border border-[#F0F0F0] hover:border-[#B11116] hover:bg-[#FDF2F2] transition-colors"
                    >
                      <img
                        src={resolveMediaUrl(prod.main_image)}
                        alt={prod.title}
                        className="w-9 h-9 rounded-lg object-cover bg-[#F8F8F8] shrink-0"
                      />
                      <span className="text-xs font-semibold text-[#111111] truncate">{prod.title}</span>
                    </AppLink>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Executive B2B Black Footer */}
      <footer className="bg-[#111111] text-white mt-16 border-t-4 border-[#B11116] no-print">
        <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-white/15">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-lg font-extrabold text-white">
                <Coffee className="w-5 h-5 text-[#B11116]" />
                <span>باریستاپرو</span>
              </div>
              <p className="text-xs text-white/75 leading-relaxed">
                مرجع تخصصی تامین عمده و خرده دان قهوه اسپرسو، سیروپ‌ها، لیوان کاغذی و تجهیزات باریستا ویژه کافی‌شاپ‌ها و روسترهای حرفه‌ای.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold mb-3 text-white">دسترسی سریع فروشگاه</h3>
              <ul className="space-y-2.5 text-xs text-white/75">
                <li><AppLink to="/category/coffee-beans" className="hover:text-[#F87171] hover:underline transition-colors">دان قهوه و اسپرسو</AppLink></li>
                <li><AppLink to="/category/disposable-cups" className="hover:text-[#F87171] hover:underline transition-colors">لیوان دوجداره بیرون‌بر</AppLink></li>
                <li><AppLink to="/category/coffee-syrups" className="hover:text-[#F87171] hover:underline transition-colors">سیروپ و طعم‌دهنده‌ها</AppLink></li>
                <li><AppLink to="/category/barista-tools" className="hover:text-[#F87171] hover:underline transition-colors">ابزار دقیق باریستا</AppLink></li>
                {navData?.footer?.map((item) => (
                  <li key={item.id}>
                    <AppLink to={item.target_url} className="hover:text-[#F87171] hover:underline transition-colors">
                      {item.label}
                    </AppLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold mb-3 text-white">خدمات مشتریان و قوانین</h3>
              <ul className="space-y-2.5 text-xs text-white/75">
                <li><AppLink to="/shipping-policy" className="hover:text-[#F87171] hover:underline transition-colors">رویه ارسال و باربری</AppLink></li>
                <li><AppLink to="/return-policy" className="hover:text-[#F87171] hover:underline transition-colors">ضمانت و شرایط مرجوعی</AppLink></li>
                <li><AppLink to="/privacy-policy" className="hover:text-[#F87171] hover:underline transition-colors">حریم خصوصی</AppLink></li>
                <li><AppLink to="/terms" className="hover:text-[#F87171] hover:underline transition-colors">شرایط و قوانین استفاده</AppLink></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">اطلاعات تماس و اعتماد</h3>
              <div className="space-y-2.5 text-xs text-white/80">
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#B11116] shrink-0" /> ۰۲۱-۸۸۴۵۹۲۱۰ (پاسخگویی ۹ تا ۱۹)</p>
                <p className="flex items-center gap-2"><Truck className="w-4 h-4 text-[#B11116] shrink-0" /> ارسال فوری تهران و باربری سراسر کشور</p>
                <p className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#B11116] shrink-0" /> تضمین اصالت کالا و سلامت فیزیکی</p>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/65">
            <p>© ۱۴۰۵ باریستاپرو — سامانه تخصصی تامین ملزومات کافی‌شاپ. تمامی حقوق محفوظ است.</p>
            <div className="flex items-center gap-4">
              <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:text-white hover:underline">نقشه سایت XML</a>
              <a href="/robots.txt" target="_blank" rel="noreferrer" className="hover:text-white hover:underline">Robots.txt</a>
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <AuthModal />
    </div>
  );
}
