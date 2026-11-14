import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Image as ImageIcon,
  FolderTree,
  Boxes,
  ShoppingCart,
  CreditCard,
  Truck,
  Tag,
  Users,
  Menu as MenuIcon,
  FileText,
  Search,
  Shield,
  Activity,
  Settings,
  Server,
  Bell,
  Plus,
  ArrowRight,
  Lock,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, formatPersianDate, toPersianDigits } from '../lib/format';
import { AppLink } from '../components/AppLink';
import { Brand, Category, Product, SeoPageRecord } from '../types';
import { DashboardOverview } from '../components/admin/DashboardOverview';
import { CatalogAndMediaSection } from '../components/admin/CatalogAndMediaSection';
import { SalesAndCustomersSection } from '../components/admin/SalesAndCustomersSection';
import { MenusCmsSeoSystemSection } from '../components/admin/MenusCmsSeoSystemSection';

export type EnterpriseTab =
  | 'dashboard'
  | 'products'
  | 'media'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'payments'
  | 'shipping'
  | 'coupons'
  | 'customers'
  | 'menus'
  | 'cms'
  | 'seo'
  | 'rbac'
  | 'audit'
  | 'settings'
  | 'system';

interface NavGroup {
  groupLabel: string;
  items: Array<{
    id: EnterpriseTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    perm?: string;
  }>;
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: 'نمای کلی',
    items: [{ id: 'dashboard', label: 'داشبورد و هوش تجاری', icon: LayoutDashboard, perm: 'dashboard.view' }],
  },
  {
    groupLabel: 'کاتالوگ و انبار',
    items: [
      { id: 'products', label: 'محصولات و قیمت عمده', icon: Package, perm: 'products.view' },
      { id: 'media', label: 'کتابخانه رسانه و تصاویر', icon: ImageIcon, perm: 'media.manage' },
      { id: 'categories', label: 'دسته‌بندی و برندها', icon: FolderTree, perm: 'categories.manage' },
      { id: 'inventory', label: 'انبارداری و کاردکس کالا', icon: Boxes, perm: 'inventory.view' },
    ],
  },
  {
    groupLabel: 'فروش و ارسال',
    items: [
      { id: 'orders', label: 'سفارشات و فاکتورها', icon: ShoppingCart, perm: 'orders.view' },
      { id: 'payments', label: 'تراکنش‌ها و فیش بانکی', icon: CreditCard, perm: 'payments.view' },
      { id: 'shipping', label: 'روش‌های ارسال', icon: Truck, perm: 'shipping.manage' },
      { id: 'coupons', label: 'کدهای تخفیف', icon: Tag, perm: 'coupons.manage' },
    ],
  },
  {
    groupLabel: 'مشتریان و B2B',
    items: [{ id: 'customers', label: 'مشتریان و همکاران عمده', icon: Users, perm: 'customers.view' }],
  },
  {
    groupLabel: 'ناوبری و محتوا',
    items: [
      { id: 'menus', label: 'منوساز همبرگری و سایت', icon: MenuIcon, perm: 'menus.manage' },
      { id: 'cms', label: 'بنرها، مقالات و سوالات', icon: FileText, perm: 'cms.manage' },
    ],
  },
  {
    groupLabel: 'سئو و بهینه‌سازی',
    items: [{ id: 'seo', label: 'موتور سئو (Rank Math)', icon: Search, perm: 'seo.manage' }],
  },
  {
    groupLabel: 'سیستم و امنیت',
    items: [
      { id: 'rbac', label: 'پرسنل و دسترسی‌ها', icon: Shield, perm: 'users.manage' },
      { id: 'audit', label: 'گزارش ممیزی (Audit)', icon: Activity, perm: 'audit.view' },
      { id: 'settings', label: 'تنظیمات و حساب بانکی', icon: Settings, perm: 'settings.manage' },
      { id: 'system', label: 'سلامت سیستم و نگهداری', icon: Server, perm: 'system.health' },
    ],
  },
];

export function AdminPanelPage() {
  const { user, setUser, refreshCart, notify } = useStore();
  const [tab, setTab] = useState<EnterpriseTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Dedicated Admin Login Gate state
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Core Admin Data State
  const [dashRange, setDashRange] = useState('all');
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [dash, setDash] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [seoPages, setSeoPages] = useState<SeoPageRecord[]>([]);
  const [redirects, setRedirects] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Header utilities
  const [globalSearch, setGlobalSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [initialOrderFilter, setInitialOrderFilter] = useState('all');
  const [newProductTrigger, setNewProductTrigger] = useState(0);

  const isAdmin = Boolean(user && (user.role === 'admin' || user.role === 'manager'));

  const can = (perm?: string) => {
    if (!perm) return true;
    if (!user) return false;
    if (user.role === 'admin' || user.admin_role_key === 'super_admin') return true;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  };

  const submitAdminLogin = async (mobileInput: string, passwordInput: string) => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await apiFetch<{ user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: mobileInput, password: passwordInput }),
      });
      if (res.user.role !== 'admin' && res.user.role !== 'manager') {
        setLoginError('این حساب کاربری دسترسی مدیریت ندارد. لطفاً با حساب مدیر وارد شوید.');
        return;
      }
      setUser(res.user);
      await refreshCart();
      notify(`خوش آمدید، ${res.user.name}`);
    } catch (err: any) {
      setLoginError(err.message || 'خطا در احراز هویت مدیر');
    } finally {
      setLoginLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await apiFetch<{ notifications: any[] }>('/api/admin/notifications');
      setNotifications(res.notifications || []);
    } catch {
      // ignore
    }
  };

  const loadDashboardOnly = async (range = dashRange) => {
    try {
      const d = await apiFetch(`/api/admin/dashboard?range=${range}`);
      setDash(d);
    } catch {
      // ignore
    }
  };

  const loadAll = async () => {
    if (!isAdmin) return;
    setDataLoading(true);
    setDataError('');
    try {
      const results = await Promise.allSettled([
        apiFetch(`/api/admin/dashboard?range=${dashRange}`),
        apiFetch<{ products: Product[] }>('/api/admin/products'),
        apiFetch<{ categories: Category[] }>('/api/admin/categories'),
        apiFetch<{ brands: Brand[] }>('/api/admin/brands'),
        apiFetch<{ orders: any[] }>('/api/admin/orders'),
        apiFetch<{ customers: any[] }>('/api/admin/customers'),
        apiFetch<{ coupons: any[] }>('/api/admin/coupons'),
        apiFetch<{ pages: SeoPageRecord[]; redirects: any[] }>('/api/admin/seo'),
        apiFetch<{ settings: Record<string, string> }>('/api/admin/settings'),
        apiFetch<{ notifications: any[] }>('/api/admin/notifications'),
      ]);

      const [dRes, pRes, catRes, brRes, oRes, cRes, cpRes, sRes, stRes, nRes] = results;

      if (dRes.status === 'fulfilled') setDash(dRes.value);
      if (pRes.status === 'fulfilled') setProducts(pRes.value.products || []);
      if (catRes.status === 'fulfilled') setCategories(catRes.value.categories || []);
      if (brRes.status === 'fulfilled') setBrands(brRes.value.brands || []);
      if (oRes.status === 'fulfilled') setOrders(oRes.value.orders || []);
      if (cRes.status === 'fulfilled') setCustomers(cRes.value.customers || []);
      if (cpRes.status === 'fulfilled') setCoupons(cpRes.value.coupons || []);
      if (sRes.status === 'fulfilled') {
        setSeoPages(sRes.value.pages || []);
        setRedirects(sRes.value.redirects || []);
      }
      if (stRes.status === 'fulfilled') setSettings(stRes.value.settings || {});
      if (nRes.status === 'fulfilled') setNotifications(nRes.value.notifications || []);

      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (rejected.length === results.length) {
        const firstMsg = rejected[0].reason?.message || 'خطا در برقراری ارتباط با سرور';
        setDataError(firstMsg);
        notify(firstMsg, 'error');
      }
    } catch (err: any) {
      const msg = err.message || 'خطا در بارگذاری داده‌های پنل مدیریت';
      setDataError(msg);
      notify(msg, 'error');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (isAdmin) loadDashboardOnly(dashRange);
  }, [dashRange]);

  const globalResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return null;
    return {
      products: products.filter((p) => `${p.title} ${p.sku}`.toLowerCase().includes(q)).slice(0, 4),
      orders: orders.filter((o) => `${o.order_number} ${o.customer_name} ${o.customer_mobile}`.toLowerCase().includes(q)).slice(0, 4),
      customers: customers.filter((c) => `${c.name} ${c.cafe_name || ''} ${c.mobile}`.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [globalSearch, products, orders, customers]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const activeNavLabel = useMemo(() => {
    for (const g of ADMIN_NAV_GROUPS) {
      const found = g.items.find((i) => i.id === tab);
      if (found) return found.label;
    }
    return 'داشبورد';
  }, [tab]);

  // Dedicated Admin Login Gate
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 lg:py-16">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-[#111111] text-white p-6 lg:p-7 border-b-4 border-[#B11116]">
            <div className="flex items-center gap-2.5 text-lg font-extrabold">
              <ShieldCheck className="w-6 h-6 text-[#B11116] shrink-0" />
              <h1>ورود به پنل مدیریت جامع باریستاپرو</h1>
            </div>
            <p className="text-xs sm:text-sm text-white/80 mt-2 leading-relaxed">
              مدیریت کامل محصولات و تصاویر، منوساز همبرگری، سفارشات و فاکتورها، انبارداری، مشتریان عمده B2B و موتور سئو.
            </p>
          </div>

          <div className="p-6 lg:p-8 space-y-6">
            {user && (
              <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-[#B11116]/30 text-xs text-[#111111] leading-relaxed">
                شما هم‌اکنون با حساب مشتری (<strong className="text-[#B11116]">{user.name}</strong>) وارد شده‌اید. برای مشاهده پنل ادمین با حساب مدیر وارد شوید.
              </div>
            )}

            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {loginError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAdminLogin(loginMobile, loginPassword);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1.5">شماره موبایل یا ایمیل مدیر</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  placeholder="09120000001"
                  className="w-full px-3.5 py-3 text-sm text-left bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1.5">رمز عبور مدیر</label>
                <input
                  type="password"
                  required
                  dir="ltr"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-3 text-sm text-left bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full min-h-[48px] py-3 px-6 bg-[#111111] text-white text-sm font-bold rounded-xl hover:bg-[#262626] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loginLoading ? 'در حال بررسی دسترسی...' : 'ورود با اطلاعات حساب مدیر'}
              </button>
            </form>

            <div className="pt-5 border-t border-[#E5E5E5] space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-[#525252]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#111111]">
                  <Lock className="w-4 h-4 text-[#B11116]" />
                  <span>دسترسی فوری پیش‌نمایش مدیر کل</span>
                </span>
                <span dir="ltr" className="tabular-nums text-[11px] text-[#525252]">
                  09120000001
                </span>
              </div>

              <button
                type="button"
                disabled={loginLoading}
                onClick={() => submitAdminLogin('09120000001', 'Admin@1405')}
                className="w-full min-h-[52px] py-3.5 px-6 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#8E0D11] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>ورود سریع یک‌کلیکی مدیر کل</span>
              </button>
            </div>

            <div className="pt-2 text-center">
              <AppLink
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#525252] hover:text-[#B11116] transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>بازگشت به صفحه اصلی فروشگاه</span>
              </AppLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderSidebarContent = () => (
    <div className="space-y-4">
      <div className="px-2 pb-3 border-b border-[#F0F0F0] flex items-center justify-between gap-2">
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-[#B11116] truncate">پنل مدیریت باریستاپرو</div>
            <div className="text-[11px] text-[#525252] truncate">{user?.name}</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex p-1.5 rounded-lg border border-[#E5E5E5] text-[#525252] hover:text-[#111111] cursor-pointer"
          title={sidebarCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}
        >
          {sidebarCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
        </button>
      </div>

      {ADMIN_NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((it) => can(it.perm));
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.groupLabel} className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 text-[11px] font-bold text-[#8C8C8C]">{group.groupLabel}</div>
            )}
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  title={item.label}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#111111] text-white'
                      : 'text-[#525252] hover:bg-[#FDF2F2] hover:text-[#B11116]'
                  } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
      {/* Top Executive Admin Bar */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="lg:hidden min-h-[40px] px-3 border border-[#E5E5E5] rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <MenuIcon className="w-4 h-4" />
            <span>منوی مدیریت</span>
          </button>

          <div className="text-xs flex items-center gap-1.5 text-[#525252]">
            <span className="font-bold text-[#111111]">پنل مدیریت</span>
            <span>/</span>
            <span className="font-bold text-[#B11116]">{activeNavLabel}</span>
          </div>
        </div>

        {/* Global Search */}
        <div className="relative flex-1 max-w-sm">
          <input
            type="search"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="جستجوی سریع محصول، شماره سفارش یا مشتری..."
            className="w-full pr-9 pl-3 py-2 text-xs bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none"
          />
          <Search className="w-4 h-4 text-[#525252] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

          {globalResults && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-[#E5E5E5] rounded-xl shadow-xl z-40 p-3 space-y-2 text-xs max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] text-[#525252]">
                <span>نتایج جستجوی سراسری</span>
                <button type="button" onClick={() => setGlobalSearch('')} className="cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {globalResults.products.map((p) => (
                <button
                  key={`gp-${p.id}`}
                  type="button"
                  onClick={() => {
                    setTab('products');
                    setGlobalSearch('');
                  }}
                  className="w-full text-right p-2 rounded-lg hover:bg-[#FDF2F2] flex justify-between cursor-pointer"
                >
                  <span className="font-bold truncate">{p.title}</span>
                  <span className="text-[#B11116] shrink-0">محصول</span>
                </button>
              ))}
              {globalResults.orders.map((o) => (
                <button
                  key={`go-${o.id}`}
                  type="button"
                  onClick={() => {
                    setTab('orders');
                    setGlobalSearch('');
                  }}
                  className="w-full text-right p-2 rounded-lg hover:bg-[#FDF2F2] flex justify-between cursor-pointer"
                >
                  <span className="font-bold tabular-nums">{o.order_number} — {o.customer_name}</span>
                  <span className="text-[#111111] shrink-0">سفارش</span>
                </button>
              ))}
              {globalResults.customers.map((c) => (
                <button
                  key={`gc-${c.id}`}
                  type="button"
                  onClick={() => {
                    setTab('customers');
                    setGlobalSearch('');
                  }}
                  className="w-full text-right p-2 rounded-lg hover:bg-[#FDF2F2] flex justify-between cursor-pointer"
                >
                  <span className="font-bold">{c.name} ({c.mobile})</span>
                  <span className="text-[#525252] shrink-0">مشتری</span>
                </button>
              ))}
              {globalResults.products.length === 0 && globalResults.orders.length === 0 && globalResults.customers.length === 0 && (
                <div className="text-center py-3 text-[#525252]">موردی یافت نشد</div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {can('products.create') && (
            <button
              type="button"
              onClick={() => {
                setTab('products');
                setNewProductTrigger((n) => n + 1);
              }}
              className="min-h-[40px] px-4 py-2 bg-[#B11116] text-white text-xs font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>محصول جدید</span>
            </button>
          )}

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="min-h-[40px] min-w-[40px] px-2.5 border border-[#E5E5E5] rounded-xl flex items-center justify-center relative hover:border-[#111111] cursor-pointer"
              aria-label="اعلان‌ها"
            >
              <Bell className="w-4 h-4 text-[#111111]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 text-[10px] font-extrabold bg-[#B11116] text-white rounded-md tabular-nums">
                  {toPersianDigits(unreadCount)}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-[#E5E5E5] rounded-2xl shadow-xl z-40 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                  <strong className="text-[#111111]">اعلان‌های سیستم</strong>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/admin/notifications/read', { method: 'PATCH', body: JSON.stringify({}) });
                      loadNotifications();
                    }}
                    className="text-[#B11116] font-bold hover:underline cursor-pointer"
                  >
                    خواندن همه
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[#F5F5F5]">
                  {notifications.length === 0 ? (
                    <div className="py-4 text-center text-[#525252]">اعلان جدیدی وجود ندارد.</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`py-2.5 space-y-0.5 ${!n.is_read ? 'font-bold' : 'text-[#525252]'}`}>
                        <div className="text-[#111111]">{n.title}</div>
                        <div className="text-[11px]">{n.body}</div>
                        <div className="text-[10px] text-[#8C8C8C]">{formatPersianDate(n.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <AppLink
            to="/"
            className="min-h-[40px] px-3.5 py-2 border border-[#E5E5E5] rounded-xl text-xs font-bold text-[#111111] hover:border-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">فروشگاه</span>
          </AppLink>
        </div>
      </div>

      {/* Main Layout: Collapsible Sidebar + Workspace */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="lg:hidden w-full bg-white border border-[#E5E5E5] rounded-2xl p-4 no-print">
            {renderSidebarContent()}
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:block bg-white border border-[#E5E5E5] rounded-2xl p-3.5 shrink-0 sticky top-24 transition-all no-print ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {renderSidebarContent()}
        </aside>

        {/* Active Module Workspace */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {dataLoading && !dash && (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-[#E5E5E5] rounded-xl w-72" />
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-24 bg-[#E5E5E5] rounded-xl" />
                ))}
              </div>
              <div className="h-64 bg-[#E5E5E5] rounded-2xl" />
            </div>
          )}

          {dataError && (
            <div className="bg-white border border-[#B11116]/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#B11116]">{dataError}</p>
                <p className="text-xs text-[#525252]">در صورت نیاز می‌توانید نشست مدیر را مجدداً متصل کنید.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadAll}
                  className="min-h-[40px] px-4 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  تلاش مجدد
                </button>
                <button
                  type="button"
                  onClick={() => submitAdminLogin('09120000001', 'Admin@1405')}
                  className="min-h-[40px] px-4 py-2 bg-[#B11116] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  اتصال مجدد نشست مدیر
                </button>
              </div>
            </div>
          )}

          {tab === 'dashboard' && (
            <DashboardOverview
              dash={dash}
              range={dashRange}
              onRangeChange={setDashRange}
              onRefresh={loadAll}
              onNavigateTab={(targetTab, subFilter) => {
                if (subFilter) setInitialOrderFilter(subFilter);
                setTab(targetTab as EnterpriseTab);
              }}
            />
          )}

          {(tab === 'products' || tab === 'media' || tab === 'categories' || tab === 'inventory') && (
            <CatalogAndMediaSection
              mode={tab}
              products={products}
              categories={categories}
              brands={brands}
              onRefreshAll={loadAll}
              openNewProductTrigger={newProductTrigger}
            />
          )}

          {(tab === 'orders' || tab === 'payments' || tab === 'shipping' || tab === 'coupons' || tab === 'customers') && (
            <SalesAndCustomersSection
              mode={tab}
              orders={orders}
              customers={customers}
              coupons={coupons}
              initialOrderFilter={initialOrderFilter}
              onRefreshAll={loadAll}
            />
          )}

          {(tab === 'menus' || tab === 'cms' || tab === 'seo' || tab === 'rbac' || tab === 'audit' || tab === 'settings' || tab === 'system') && (
            <MenusCmsSeoSystemSection
              mode={tab}
              products={products}
              categories={categories}
              seoPages={seoPages}
              redirects={redirects}
              settings={settings}
              setSettings={setSettings}
              onRefreshAll={loadAll}
            />
          )}
        </div>
      </div>
    </div>
  );
}
