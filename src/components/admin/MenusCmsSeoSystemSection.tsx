import React, { useEffect, useState } from 'react';
import {
  Menu as MenuIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  FileText,
  Shield,
  Activity,
  Settings,
  Server,
  ImagePlus,
  Check,
} from 'lucide-react';
import {
  apiFetch,
  formatPersianDate,
  generateSlug,
  toPersianDigits,
} from '../../lib/format';
import { resolveMediaUrl } from '../../lib/mediaRegistry';
import { Category, NavigationItem, Product, SeoPageRecord } from '../../types';
import { useStore } from '../../context/StoreContext';
import { MediaPickerModal } from './MediaPickerModal';

interface MenusCmsSeoSystemSectionProps {
  mode: 'menus' | 'cms' | 'seo' | 'rbac' | 'audit' | 'settings' | 'system';
  products: Product[];
  categories: Category[];
  seoPages: SeoPageRecord[];
  redirects: any[];
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onRefreshAll: () => void;
}

const PERMISSION_LABELS: Record<string, string> = {
  'dashboard.view': 'مشاهده داشبورد و آمار',
  'products.view': 'مشاهده محصولات',
  'products.create': 'ایجاد محصول',
  'products.update': 'ویرایش محصول',
  'products.delete': 'حذف / آرشیو محصول',
  'categories.manage': 'مدیریت دسته‌بندی و برند',
  'media.manage': 'کتابخانه رسانه و آپلود تصویر',
  'inventory.view': 'مشاهده کاردکس انبار',
  'inventory.adjust': 'تعدیل و ثبت سند انبار',
  'orders.view': 'مشاهده سفارشات',
  'orders.update': 'تغییر وضعیت و کد رهگیری',
  'orders.cancel_refund': 'لغو سفارش و استرداد وجه',
  'payments.view': 'مشاهده تراکنش‌ها',
  'payments.review': 'تایید و رد فیش بانکی',
  'shipping.manage': 'روش‌های ارسال',
  'customers.view': 'مشاهده مشتریان',
  'customers.update': 'تایید حساب عمده و ویرایش مشتری',
  'coupons.manage': 'کدهای تخفیف',
  'menus.manage': 'منوساز همبرگری و ناوبری',
  'cms.manage': 'مدیریت محتوا، بنر و بلاگ',
  'seo.manage': 'موتور سئو و ریدایرکت‌ها',
  'settings.manage': 'تنظیمات فروشگاه و بانک',
  'users.manage': 'کاربران مدیر و ماتریس دسترسی',
  'audit.view': 'لاگ ممیزی فعالیت‌ها',
  'reports.export': 'خروجی گزارش CSV',
  'system.health': 'سلامت سیستم و نگهداری',
};

export function MenusCmsSeoSystemSection({
  mode,
  products,
  categories,
  seoPages,
  redirects,
  settings,
  setSettings,
  onRefreshAll,
}: MenusCmsSeoSystemSectionProps) {
  const { notify } = useStore();

  // Menu Builder state
  const [menuItems, setMenuItems] = useState<NavigationItem[]>([]);
  const [showHamburgerBestsellers, setShowHamburgerBestsellers] = useState(true);
  const [menuForm, setMenuForm] = useState({
    location: 'mobile_drawer' as 'header' | 'mobile_drawer' | 'footer' | 'both',
    link_type: 'product' as 'product' | 'category' | 'blog' | 'page' | 'custom',
    label: '',
    target_slug: '',
    target_url: '',
  });
  const [productPickerQuery, setProductPickerQuery] = useState('');

  // CMS state
  const [cmsTab, setCmsTab] = useState<'hero' | 'blog' | 'faqs'>('hero');
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [heroForm, setHeroForm] = useState({
    hero_kicker: '',
    hero_title: '',
    hero_subtitle: '',
    hero_image: 'hero_coffee_roastery',
    hero_cta_label: 'مشاهده کاتالوگ محصولات',
  });
  const [homepageSections, setHomepageSections] = useState<Array<{ key: string; title: string; visible: boolean }>>([]);
  const [heroImagePicker, setHeroImagePicker] = useState(false);
  const [blogForm, setBlogForm] = useState({ id: 0, title: '', slug: '', category_name: 'آموزش باریستا', excerpt: '', content: '', cover_image: 'prod_barista_tools', read_time_min: 5 });
  const [blogCoverPicker, setBlogCoverPicker] = useState(false);
  const [faqForm, setFaqForm] = useState({ id: 0, question: '', answer: '', category: 'خرید و ارسال', display_order: 0 });

  // SEO state
  const [seoSearch, setSeoSearch] = useState('');
  const [selectedSeoId, setSelectedSeoId] = useState<number | null>(null);
  const [seoForm, setSeoForm] = useState<any>(null);
  const [liveAudit, setLiveAudit] = useState<any>(null);
  const [redirSource, setRedirSource] = useState('');
  const [redirTarget, setRedirTarget] = useState('');
  const [redirCode, setRedirCode] = useState(301);

  // RBAC state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPerms, setAllPerms] = useState<string[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState('store_manager');
  const [rolePermDraft, setRolePermDraft] = useState<string[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', mobile: '', email: '', password: '', admin_role_key: 'product_manager' });

  // Audit & System Health state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditQuery, setAuditQuery] = useState('');
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const loadMenus = async () => {
    try {
      const res = await apiFetch<{ items: NavigationItem[]; hamburger_show_bestsellers: boolean }>('/api/admin/menus');
      setMenuItems(res.items || []);
      setShowHamburgerBestsellers(res.hamburger_show_bestsellers);
    } catch {
      // ignore
    }
  };

  const loadCms = async () => {
    try {
      const res = await apiFetch<any>('/api/admin/cms');
      setBlogPosts(res.posts || []);
      setFaqs(res.faqs || []);
      setHeroForm(res.hero || {});
      setHomepageSections(
        res.homepage_sections?.length
          ? res.homepage_sections
          : [
              { key: 'hero', title: 'بنر اصلی فروشگاه', visible: true },
              { key: 'categories', title: 'دسته‌بندی‌های تخصصی کافه', visible: true },
              { key: 'bestsellers', title: 'پرفروش‌ترین ملزومات کافی‌شاپ', visible: true },
              { key: 'blog', title: 'آکادمی و راهنمای فنی باریستا', visible: true },
            ]
      );
    } catch {
      // ignore
    }
  };

  const loadRbac = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        apiFetch<{ users: any[] }>('/api/admin/users'),
        apiFetch<{ roles: any[]; all_permissions: string[] }>('/api/admin/roles'),
      ]);
      setAdminUsers(uRes.users || []);
      setRoles(rRes.roles || []);
      setAllPerms(rRes.all_permissions || []);
      const activeRole = (rRes.roles || []).find((r) => r.role_key === selectedRoleKey) || rRes.roles?.[0];
      if (activeRole) {
        setSelectedRoleKey(activeRole.role_key);
        setRolePermDraft(activeRole.permissions || []);
      }
    } catch {
      // ignore
    }
  };

  const loadAudit = async (q = '') => {
    try {
      const res = await apiFetch<{ logs: any[] }>(`/api/admin/audit-logs?q=${encodeURIComponent(q)}`);
      setAuditLogs(res.logs || []);
    } catch {
      // ignore
    }
  };

  const loadHealth = async () => {
    try {
      const res = await apiFetch('/api/admin/system/health');
      setSystemHealth(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (mode === 'menus') loadMenus();
    if (mode === 'cms') loadCms();
    if (mode === 'rbac') loadRbac();
    if (mode === 'audit') loadAudit(auditQuery);
    if (mode === 'system') loadHealth();
    if (mode === 'seo' && seoPages.length > 0 && !selectedSeoId) {
      const first = seoPages[0];
      setSelectedSeoId(first.id);
      setSeoForm({
        seo_title: first.seo_title,
        meta_description: first.meta_description,
        focus_keyword: first.focus_keyword,
        secondary_keywords: first.secondary_keywords,
        canonical_url: first.canonical_url || first.url_path,
        robots_index: first.robots_index === 1,
        robots_follow: first.robots_follow === 1,
        schema_type: first.schema_type,
        custom_json_ld: first.custom_json_ld || '',
        url_path: first.url_path,
      });
      setLiveAudit(first.analysis);
    }
  }, [mode, seoPages.length]);

  const notifyNavChanged = () => {
    window.dispatchEvent(new Event('bp-navigation-updated'));
  };

  // ========================
  // MODE 1: HAMBURGER & SITE MENU BUILDER
  // ========================
  if (mode === 'menus') {
    const filteredPickerProducts = products
      .filter((p) =>
        !productPickerQuery.trim()
          ? true
          : `${p.title} ${p.sku}`.toLowerCase().includes(productPickerQuery.trim().toLowerCase())
      )
      .slice(0, 8);

    const handleMoveOrder = async (index: number, dir: -1 | 1) => {
      const targetIndex = index + dir;
      if (targetIndex < 0 || targetIndex >= menuItems.length) return;
      const reordered = [...menuItems];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      const payload = reordered.map((item, idx) => ({ id: item.id, display_order: idx + 1 }));
      setMenuItems(reordered.map((item, idx) => ({ ...item, display_order: idx + 1 })));
      await apiFetch('/api/admin/menus/reorder', {
        method: 'POST',
        body: JSON.stringify({ items: payload }),
      });
      notifyNavChanged();
      notify('ترتیب منو ذخیره و در سایت اعمال شد');
    };

    const locationLabel = (loc: string) => {
      if (loc === 'mobile_drawer') return 'منوی همبرگری موبایل';
      if (loc === 'header') return 'منوی بالای سایت';
      if (loc === 'both') return 'منوی بالا + همبرگری';
      return 'فوتر سایت';
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
              <MenuIcon className="w-5 h-5 text-[#B11116]" />
              <span>منوساز همبرگری موبایل و ناوبری بالای سایت</span>
            </h1>
            <p className="text-xs text-[#525252] mt-1">
              افزودن نام محصول، دسته‌بندی یا لینک دلخواه به منوی همبرگری موبایل و منوی بالای سایت با تغییر ترتیب آنی
            </p>
          </div>

          <label className="flex items-center gap-2 bg-white border border-[#E5E5E5] rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={showHamburgerBestsellers}
              onChange={async (e) => {
                const next = e.target.checked;
                setShowHamburgerBestsellers(next);
                await apiFetch('/api/admin/menus/reorder', {
                  method: 'POST',
                  body: JSON.stringify({ items: [], hamburger_show_bestsellers: next }),
                });
                notifyNavChanged();
                notify('تنظیم نمایش پرفروش‌ترین‌ها در منوی همبرگری ذخیره شد');
              }}
            />
            <span>نمایش خودکار پرفروش‌ترین محصولات در منوی همبرگری</span>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Add Item + Product Quick Picker */}
          <div className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4 text-xs">
            <h2 className="text-sm font-extrabold text-[#111111]">افزودن آیتم یا محصول به منو</h2>

            {/* Quick Product Search Picker */}
            <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-2.5">
              <div className="font-bold text-[#111111]">انتخاب سریع محصول برای افزودن به منوی همبرگری:</div>
              <div className="relative">
                <input
                  type="search"
                  value={productPickerQuery}
                  onChange={(e) => setProductPickerQuery(e.target.value)}
                  placeholder="نام محصول را جستجو و کلیک کنید..."
                  className="w-full pr-8 pl-3 py-2 bg-white border border-[#E5E5E5] rounded-lg"
                />
                <Search className="w-3.5 h-3.5 text-[#525252] absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {filteredPickerProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setMenuForm({
                        ...menuForm,
                        link_type: 'product',
                        label: p.title,
                        target_slug: p.slug,
                        target_url: `/product/${p.slug}`,
                      });
                    }}
                    className="w-full p-2 rounded-lg bg-white border border-[#F0F0F0] hover:border-[#B11116] flex items-center justify-between gap-2 text-right cursor-pointer"
                  >
                    <span className="font-semibold text-[#111111] truncate">{p.title}</span>
                    <span className="text-[11px] font-bold text-[#B11116] shrink-0">+ انتخاب</span>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiFetch('/api/admin/menus', {
                    method: 'POST',
                    body: JSON.stringify(menuForm),
                  });
                  setMenuForm({
                    location: menuForm.location,
                    link_type: 'product',
                    label: '',
                    target_slug: '',
                    target_url: '',
                  });
                  notify('آیتم جدید به منو اضافه شد');
                  await loadMenus();
                  notifyNavChanged();
                } catch (err: any) {
                  notify(err.message, 'error');
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">محل نمایش</label>
                  <select
                    value={menuForm.location}
                    onChange={(e) => setMenuForm({ ...menuForm, location: e.target.value as any })}
                    className="w-full px-3 py-2.5 border border-[#E5E5E5] rounded-xl bg-white font-semibold"
                  >
                    <option value="mobile_drawer">منوی همبرگری موبایل</option>
                    <option value="header">منوی بالای سایت</option>
                    <option value="both">هر دو (بالا + همبرگری)</option>
                    <option value="footer">ستون فوتر</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">نوع لینک</label>
                  <select
                    value={menuForm.link_type}
                    onChange={(e) => setMenuForm({ ...menuForm, link_type: e.target.value as any })}
                    className="w-full px-3 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                  >
                    <option value="product">لینک محصول</option>
                    <option value="category">لینک دسته‌بندی</option>
                    <option value="page">صفحه داخلی</option>
                    <option value="blog">مقاله آکادمی</option>
                    <option value="custom">آدرس دلخواه</option>
                  </select>
                </div>
              </div>

              {menuForm.link_type === 'category' && (
                <select
                  onChange={(e) => {
                    const cat = categories.find((c) => String(c.id) === e.target.value);
                    if (cat) {
                      setMenuForm({
                        ...menuForm,
                        label: cat.name,
                        target_slug: cat.slug,
                        target_url: `/category/${cat.slug}`,
                      });
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                >
                  <option value="">انتخاب سریع دسته‌بندی...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              <div>
                <label className="block font-bold mb-1">عنوان نمایشی در منو *</label>
                <input
                  required
                  value={menuForm.label}
                  onChange={(e) => setMenuForm({ ...menuForm, label: e.target.value })}
                  placeholder="مثلاً دانه قهوه اسپرسو سوپریم"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">مسیر مقصد (URL) *</label>
                <input
                  required
                  dir="ltr"
                  value={menuForm.target_url}
                  onChange={(e) => setMenuForm({ ...menuForm, target_url: e.target.value })}
                  placeholder="/product/arabica-coffee-1kg"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن به منو</span>
              </button>
            </form>
          </div>

          {/* Menu Items List */}
          <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-[#111111]">آیتم‌های فعال منوهای سایت ({toPersianDigits(menuItems.length)})</h2>
            <div className="divide-y divide-[#F0F0F0] text-xs">
              {menuItems.map((item, idx) => (
                <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-extrabold text-[#111111] flex items-center gap-2">
                      <span>{item.label}</span>
                      {!item.is_active && <span className="text-[#B11116]">(مخفی)</span>}
                    </div>
                    <div className="text-[#525252] flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#B11116]">{locationLabel(item.location)}</span>
                      <span>·</span>
                      <span dir="ltr" className="tabular-nums">{item.target_url}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(idx, -1)}
                      disabled={idx === 0}
                      className="p-2 border border-[#E5E5E5] rounded-lg disabled:opacity-30 cursor-pointer"
                      title="انتقال به بالا"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(idx, 1)}
                      disabled={idx === menuItems.length - 1}
                      className="p-2 border border-[#E5E5E5] rounded-lg disabled:opacity-30 cursor-pointer"
                      title="انتقال به پایین"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/menus/${item.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ is_active: item.is_active ? 0 : 1 }),
                        });
                        await loadMenus();
                        notifyNavChanged();
                      }}
                      className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold cursor-pointer"
                    >
                      {item.is_active ? 'فعال' : 'مخفی'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/menus/${item.id}`, { method: 'DELETE' });
                        notify('آیتم از منو حذف شد');
                        await loadMenus();
                        notifyNavChanged();
                      }}
                      className="p-2 border border-[#B11116]/30 text-[#B11116] rounded-lg hover:bg-[#B11116] hover:text-white cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // MODE 2: CMS (HERO, BLOG, FAQ)
  // ========================
  if (mode === 'cms') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#B11116]" />
            <span>مدیریت محتوا، بنر صفحه اول، مقالات و سوالات متداول</span>
          </h1>
          <div className="inline-flex border border-[#E5E5E5] bg-white rounded-xl p-1 gap-1">
            {[
              { id: 'hero', label: 'بنر و چیدمان صفحه نخست' },
              { id: 'blog', label: 'مقالات آکادمی' },
              { id: 'faqs', label: 'سوالات متداول' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCmsTab(t.id as any)}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  cmsTab === t.id ? 'bg-[#111111] text-white' : 'text-[#525252]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {cmsTab === 'hero' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-xs">
            <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-extrabold text-[#111111]">ویرایش بنر اصلی صفحه نخست</h2>
              <div>
                <label className="block font-bold mb-1">روتیتر قرمز بالای بنر</label>
                <input
                  value={heroForm.hero_kicker || ''}
                  onChange={(e) => setHeroForm({ ...heroForm, hero_kicker: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">تیتر اصلی بنر (H1)</label>
                <input
                  value={heroForm.hero_title || ''}
                  onChange={(e) => setHeroForm({ ...heroForm, hero_title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">متن توضیح زیر تیتر</label>
                <textarea
                  rows={3}
                  value={heroForm.hero_subtitle || ''}
                  onChange={(e) => setHeroForm({ ...heroForm, hero_subtitle: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">متن دکمه اصلی</label>
                  <input
                    value={heroForm.hero_cta_label || ''}
                    onChange={(e) => setHeroForm({ ...heroForm, hero_cta_label: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <img src={resolveMediaUrl(heroForm.hero_image)} alt="" className="w-20 h-12 rounded-lg object-cover border border-[#E5E5E5]" />
                  <button
                    type="button"
                    onClick={() => setHeroImagePicker(true)}
                    className="min-h-[42px] px-4 py-2 border border-[#111111] rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>تغییر تصویر بنر</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch('/api/admin/cms/homepage', {
                    method: 'PUT',
                    body: JSON.stringify({ hero: heroForm, homepage_sections: homepageSections }),
                  });
                  notify('بنر اصلی و چیدمان صفحه نخست ذخیره شد');
                }}
                className="min-h-[44px] px-6 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] cursor-pointer"
              >
                ذخیره تنظیمات صفحه نخست
              </button>
            </div>

            <div className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-extrabold text-[#111111]">ترتیب و نمایش بخش‌های صفحه نخست</h2>
              <div className="space-y-2">
                {homepageSections.map((sec, idx) => (
                  <div key={sec.key} className="p-3 rounded-xl border border-[#E5E5E5] flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sec.visible !== false}
                        onChange={(e) =>
                          setHomepageSections((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, visible: e.target.checked } : s))
                          )
                        }
                      />
                      <span>{sec.title}</span>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const next = [...homepageSections];
                          const [m] = next.splice(idx, 1);
                          next.splice(idx - 1, 0, m);
                          setHomepageSections(next);
                        }}
                        className="p-1.5 border border-[#E5E5E5] rounded disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === homepageSections.length - 1}
                        onClick={() => {
                          const next = [...homepageSections];
                          const [m] = next.splice(idx, 1);
                          next.splice(idx + 1, 0, m);
                          setHomepageSections(next);
                        }}
                        className="p-1.5 border border-[#E5E5E5] rounded disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <MediaPickerModal
              open={heroImagePicker}
              onClose={() => setHeroImagePicker(false)}
              defaultFolder="banners"
              onSelect={(url) => setHeroForm((prev) => ({ ...prev, hero_image: url }))}
            />
          </div>
        )}

        {cmsTab === 'blog' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-xs">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (blogForm.id) {
                  await apiFetch(`/api/admin/cms/blog/${blogForm.id}`, { method: 'PUT', body: JSON.stringify(blogForm) });
                  notify('مقاله بروزرسانی شد');
                } else {
                  await apiFetch('/api/admin/cms/blog', { method: 'POST', body: JSON.stringify(blogForm) });
                  notify('مقاله جدید منتشر شد');
                }
                setBlogForm({ id: 0, title: '', slug: '', category_name: 'آموزش باریستا', excerpt: '', content: '', cover_image: 'prod_barista_tools', read_time_min: 5 });
                loadCms();
              }}
              className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3"
            >
              <h2 className="text-sm font-extrabold text-[#111111]">{blogForm.id ? 'ویرایش مقاله' : 'انتشار مقاله جدید'}</h2>
              <input
                required
                value={blogForm.title}
                onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                placeholder="عنوان مقاله"
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <div className="flex gap-2">
                <input
                  required
                  dir="ltr"
                  value={blogForm.slug}
                  onChange={(e) => setBlogForm({ ...blogForm, slug: e.target.value })}
                  placeholder="article-slug"
                  className="flex-1 px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left"
                />
                <button
                  type="button"
                  onClick={() => setBlogForm({ ...blogForm, slug: generateSlug(blogForm.slug || blogForm.title) })}
                  className="px-3 border border-[#E5E5E5] rounded-xl font-bold cursor-pointer"
                >
                  اسلاگ
                </button>
              </div>
              <div className="flex items-center gap-3">
                <img src={resolveMediaUrl(blogForm.cover_image)} alt="" className="w-16 h-12 rounded-lg object-cover border border-[#E5E5E5]" />
                <button
                  type="button"
                  onClick={() => setBlogCoverPicker(true)}
                  className="px-4 py-2 border border-[#111111] rounded-xl font-bold cursor-pointer"
                >
                  انتخاب / آپلود تصویر کاور
                </button>
              </div>
              <input
                value={blogForm.excerpt}
                onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                placeholder="چکیده مقاله"
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <textarea
                rows={4}
                value={blogForm.content}
                onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                placeholder="متن کامل مقاله..."
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <button type="submit" className="w-full min-h-[44px] bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] cursor-pointer">
                {blogForm.id ? 'ذخیره تغییرات مقاله' : 'انتشار مقاله + تولید سئو'}
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl divide-y divide-[#F0F0F0]">
              {blogPosts.map((bp) => (
                <div key={bp.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={resolveMediaUrl(bp.cover_image)} alt="" className="w-14 h-11 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-[#111111] truncate">{bp.title}</div>
                      <div className="text-[#525252]">{bp.category_name}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBlogForm({ ...bp })}
                      className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold cursor-pointer"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/cms/blog/${bp.id}`, { method: 'DELETE' });
                        notify('مقاله حذف شد');
                        loadCms();
                      }}
                      className="px-3 py-1.5 border border-[#B11116]/30 text-[#B11116] rounded-lg font-bold cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <MediaPickerModal
              open={blogCoverPicker}
              onClose={() => setBlogCoverPicker(false)}
              defaultFolder="blog"
              onSelect={(url) => setBlogForm((prev) => ({ ...prev, cover_image: url }))}
            />
          </div>
        )}

        {cmsTab === 'faqs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-xs">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (faqForm.id) {
                  await apiFetch(`/api/admin/cms/faqs/${faqForm.id}`, { method: 'PUT', body: JSON.stringify(faqForm) });
                  notify('پرسش و پاسخ بروزرسانی شد');
                } else {
                  await apiFetch('/api/admin/cms/faqs', { method: 'POST', body: JSON.stringify(faqForm) });
                  notify('پرسش جدید اضافه شد');
                }
                setFaqForm({ id: 0, question: '', answer: '', category: 'خرید و ارسال', display_order: 0 });
                loadCms();
              }}
              className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3"
            >
              <h2 className="text-sm font-extrabold text-[#111111]">{faqForm.id ? 'ویرایش پرسش' : 'افزودن پرسش متداول'}</h2>
              <input
                required
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder="عنوان سوال..."
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <textarea
                required
                rows={3}
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder="متن پاسخ..."
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
              />
              <button type="submit" className="w-full min-h-[44px] bg-[#B11116] text-white font-bold rounded-xl cursor-pointer">
                {faqForm.id ? 'ذخیره تغییرات' : 'ثبت سوال متداول'}
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl divide-y divide-[#F0F0F0]">
              {faqs.map((f) => (
                <div key={f.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-[#111111]">{f.question}</div>
                    <div className="text-[#525252] line-clamp-2">{f.answer}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFaqForm({ ...f })}
                      className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg font-bold cursor-pointer"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/cms/faqs/${f.id}`, { method: 'DELETE' });
                        loadCms();
                      }}
                      className="px-3 py-1.5 border border-[#B11116]/30 text-[#B11116] rounded-lg font-bold cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // MODE 3: RANK MATH SEO ENGINE
  // ========================
  if (mode === 'seo') {
    const filteredSeo = seoPages.filter((sp) =>
      !seoSearch.trim() ? true : `${sp.seo_title} ${sp.url_path} ${sp.focus_keyword || ''}`.toLowerCase().includes(seoSearch.trim().toLowerCase())
    );
    const avgScore = seoPages.length > 0 ? Math.round(seoPages.reduce((s, p) => s + p.seo_score, 0) / seoPages.length) : 0;
    const lowSeoCount = seoPages.filter((p) => p.seo_score < 60).length;

    const runLiveSeoAnalyze = async (formState: any) => {
      try {
        const audit = await apiFetch('/api/admin/seo/analyze', {
          method: 'POST',
          body: JSON.stringify({
            url_path: formState.url_path,
            seo_title: formState.seo_title,
            meta_description: formState.meta_description,
            focus_keyword: formState.focus_keyword,
            content_text: `${formState.seo_title} ${formState.meta_description} ${formState.secondary_keywords}`,
            robots_index: formState.robots_index,
            schema_type: formState.schema_type,
            custom_json_ld: formState.custom_json_ld,
          }),
        });
        setLiveAudit(audit);
      } catch {
        // ignore
      }
    };

    const selectSeoPage = (page: SeoPageRecord) => {
      setSelectedSeoId(page.id);
      setSeoForm({
        seo_title: page.seo_title,
        meta_description: page.meta_description,
        focus_keyword: page.focus_keyword,
        secondary_keywords: page.secondary_keywords,
        canonical_url: page.canonical_url || page.url_path,
        robots_index: page.robots_index === 1,
        robots_follow: page.robots_follow === 1,
        schema_type: page.schema_type,
        custom_json_ld: page.custom_json_ld || '',
        url_path: page.url_path,
      });
      setLiveAudit(page.analysis);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#111111]">مرکز کنترل سئو پیشرفته (Rank Math) و اسکیما</h1>
            <p className="text-xs text-[#525252] mt-1">
              میانگین امتیاز کل صفحات: <strong className="tabular-nums text-[#1E6B4B]">{toPersianDigits(avgScore)} از ۱۰۰</strong> · صفحات نیازمند بهبود:{' '}
              <strong className="tabular-nums text-[#B11116]">{toPersianDigits(lowSeoCount)} صفحه</strong>
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="min-h-[40px] px-4 py-2 bg-white border border-[#111111] font-bold rounded-xl inline-flex items-center">
              Sitemap.xml
            </a>
            <a href="/robots.txt" target="_blank" rel="noreferrer" className="min-h-[40px] px-4 py-2 bg-white border border-[#111111] font-bold rounded-xl inline-flex items-center">
              Robots.txt
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-2.5 max-h-[640px] overflow-y-auto">
            <div className="text-xs font-bold text-[#111111]">صفحات سایت ({toPersianDigits(filteredSeo.length)})</div>
            <input
              type="search"
              value={seoSearch}
              onChange={(e) => setSeoSearch(e.target.value)}
              placeholder="جستجوی مسیر URL یا عنوان..."
              className="w-full px-3 py-2 text-xs bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl"
            />
            <div className="space-y-1.5 pt-1">
              {filteredSeo.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => selectSeoPage(sp)}
                  className={`w-full p-2.5 rounded-xl text-right flex items-center justify-between gap-2 text-xs cursor-pointer ${
                    selectedSeoId === sp.id ? 'bg-[#111111] text-white font-bold' : 'hover:bg-[#FDF2F2] text-[#111111]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate">{sp.seo_title}</div>
                    <div dir="ltr" className={`text-[11px] truncate text-right ${selectedSeoId === sp.id ? 'text-white/75' : 'text-[#525252]'}`}>
                      {sp.url_path}
                    </div>
                  </div>
                  <span className="font-bold tabular-nums shrink-0">{toPersianDigits(sp.seo_score)}</span>
                </button>
              ))}
            </div>
          </div>

          {seoForm && (
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-2">
                <div className="text-xs font-bold text-[#525252]">پیش‌نمایش زنده گوگل (SERP Preview)</div>
                <div className="p-4 rounded-xl bg-[#F8F8F8] border border-[#E5E5E5] space-y-1">
                  <div dir="ltr" className="text-xs text-emerald-800 text-right truncate">https://baristapro.ir{seoForm.url_path}</div>
                  <div className="text-base font-bold text-[#1a0dab]">{seoForm.seo_title || 'عنوان سئو'}</div>
                  <p className="text-xs text-[#4d5156] line-clamp-2">{seoForm.meta_description}</p>
                </div>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold">عنوان سئو</span>
                      <span className="tabular-nums text-[#525252]">{toPersianDigits((seoForm.seo_title || '').length)} / ۶۵</span>
                    </div>
                    <input
                      value={seoForm.seo_title}
                      onChange={(e) => {
                        const next = { ...seoForm, seo_title: e.target.value };
                        setSeoForm(next);
                        runLiveSeoAnalyze(next);
                      }}
                      className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">کلمه کلیدی کانونی</label>
                    <input
                      value={seoForm.focus_keyword}
                      onChange={(e) => {
                        const next = { ...seoForm, focus_keyword: e.target.value };
                        setSeoForm(next);
                        runLiveSeoAnalyze(next);
                      }}
                      className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-bold">توضیحات متا</span>
                    <span className="tabular-nums text-[#525252]">{toPersianDigits((seoForm.meta_description || '').length)} / ۱۶۵</span>
                  </div>
                  <textarea
                    rows={2}
                    value={seoForm.meta_description}
                    onChange={(e) => {
                      const next = { ...seoForm, meta_description: e.target.value };
                      setSeoForm(next);
                      runLiveSeoAnalyze(next);
                    }}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    dir="ltr"
                    value={seoForm.canonical_url}
                    onChange={(e) => setSeoForm({ ...seoForm, canonical_url: e.target.value })}
                    className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left"
                  />
                  <select
                    value={seoForm.schema_type}
                    onChange={(e) => setSeoForm({ ...seoForm, schema_type: e.target.value })}
                    className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white"
                  >
                    <option value="Product">Product</option>
                    <option value="Organization">Organization</option>
                    <option value="WebPage">WebPage</option>
                    <option value="BlogPosting">BlogPosting</option>
                    <option value="FAQPage">FAQPage</option>
                  </select>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={seoForm.robots_index} onChange={(e) => setSeoForm({ ...seoForm, robots_index: e.target.checked })} />
                      <span>Index</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={seoForm.robots_follow} onChange={(e) => setSeoForm({ ...seoForm, robots_follow: e.target.checked })} />
                      <span>Follow</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await apiFetch<{ audit: any }>(`/api/admin/seo/${selectedSeoId}`, {
                      method: 'PUT',
                      body: JSON.stringify(seoForm),
                    });
                    setLiveAudit(res.audit);
                    notify('تنظیمات سئو ذخیره و ممیزی شد');
                    onRefreshAll();
                  }}
                  className="min-h-[44px] px-6 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] cursor-pointer"
                >
                  ذخیره تنظیمات سئو
                </button>
              </div>

              {liveAudit?.checks && (
                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">چک‌لیست سئو صفحه</h3>
                    <span className="text-sm font-extrabold text-[#1E6B4B] tabular-nums">{toPersianDigits(liveAudit.score)} از ۱۰۰</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {liveAudit.checks.map((ch: any) => (
                      <div key={ch.id} className={`p-3 rounded-xl border ${ch.severity === 'good' ? 'bg-emerald-50/60 border-emerald-200' : ch.severity === 'warning' ? 'bg-amber-50/60 border-amber-200' : 'bg-rose-50/60 border-rose-200'}`}>
                        <div className="font-bold">{ch.label}</div>
                        <div className="text-[11px]">{ch.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Redirects */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-[#111111]">ریدایرکت‌های ۳۰۱ / ۳۰۲</h3>
                <div className="flex flex-wrap gap-2">
                  <input dir="ltr" value={redirSource} onChange={(e) => setRedirSource(e.target.value)} placeholder="/old-url" className="px-3 py-2 border border-[#E5E5E5] rounded-xl flex-1 text-left" />
                  <input dir="ltr" value={redirTarget} onChange={(e) => setRedirTarget(e.target.value)} placeholder="/product/new-url" className="px-3 py-2 border border-[#E5E5E5] rounded-xl flex-1 text-left" />
                  <select value={redirCode} onChange={(e) => setRedirCode(Number(e.target.value))} className="px-3 py-2 border border-[#E5E5E5] rounded-xl bg-white">
                    <option value={301}>301</option>
                    <option value={302}>302</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/admin/redirects', {
                        method: 'POST',
                        body: JSON.stringify({ source_path: redirSource, target_path: redirTarget, status_code: redirCode }),
                      });
                      setRedirSource('');
                      setRedirTarget('');
                      notify('ریدایرکت ثبت شد');
                      onRefreshAll();
                    }}
                    className="px-4 py-2 bg-[#111111] text-white font-bold rounded-xl cursor-pointer"
                  >
                    ثبت ریدایرکت
                  </button>
                </div>
                {redirects.map((r) => (
                  <div key={r.id} className="flex justify-between py-2 border-t border-[#F0F0F0]">
                    <span dir="ltr">{r.source_path} → {r.target_path} ({r.status_code})</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/redirects/${r.id}`, { method: 'DELETE' });
                        onRefreshAll();
                      }}
                      className="text-[#B11116] font-bold cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================
  // MODE 4: RBAC STAFF & PERMISSIONS MATRIX
  // ========================
  if (mode === 'rbac') {
    return (
      <div className="space-y-6 text-xs">
        <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#B11116]" />
          <span>مدیریت پرسنل، نقش‌ها و ماتریس دسترسی‌ها (RBAC)</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Staff Creation + List */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(newStaff) });
                  setNewStaff({ name: '', mobile: '', email: '', password: '', admin_role_key: 'product_manager' });
                  notify('همکار مدیر جدید ایجاد شد');
                  loadRbac();
                } catch (err: any) {
                  notify(err.message, 'error');
                }
              }}
              className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3"
            >
              <h2 className="text-sm font-extrabold text-[#111111]">افزودن کاربر مدیر / اپراتور جدید</h2>
              <input required value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} placeholder="نام و نام خانوادگی" className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl" />
              <div className="grid grid-cols-2 gap-2.5">
                <input required dir="ltr" value={newStaff.mobile} onChange={(e) => setNewStaff({ ...newStaff, mobile: e.target.value })} placeholder="0912..." className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left" />
                <input required type="password" dir="ltr" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} placeholder="رمز (حداقل ۶ حرف)" className="px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-left" />
              </div>
              <select value={newStaff.admin_role_key} onChange={(e) => setNewStaff({ ...newStaff, admin_role_key: e.target.value })} className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-white font-semibold">
                {roles.map((r) => (
                  <option key={r.role_key} value={r.role_key}>{r.title_fa}</option>
                ))}
              </select>
              <button type="submit" className="w-full min-h-[42px] bg-[#B11116] text-white font-bold rounded-xl hover:bg-[#111111] cursor-pointer">
                ایجاد حساب مدیر
              </button>
            </form>

            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-extrabold text-[#111111]">مدیران فعلی سیستم</h2>
              <div className="divide-y divide-[#F0F0F0]">
                {adminUsers.map((u) => (
                  <div key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#111111]">{u.name}</div>
                      <div className="text-[#525252] tabular-nums">{u.mobile}</div>
                    </div>
                    <select
                      value={u.admin_role_key || 'store_manager'}
                      onChange={async (e) => {
                        await apiFetch(`/api/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ admin_role_key: e.target.value }),
                        });
                        notify('نقش کاربر بروزرسانی شد');
                        loadRbac();
                      }}
                      className="px-2.5 py-1.5 border border-[#E5E5E5] rounded-lg bg-white font-semibold"
                    >
                      {roles.map((r) => (
                        <option key={r.role_key} value={r.role_key}>{r.title_fa}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Role Permission Matrix */}
          <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#111111]">تنظیم مجوزهای نقش</h2>
              <select
                value={selectedRoleKey}
                onChange={(e) => {
                  const k = e.target.value;
                  setSelectedRoleKey(k);
                  const r = roles.find((item) => item.role_key === k);
                  setRolePermDraft(r?.permissions || []);
                }}
                className="px-3.5 py-2 border border-[#111111] rounded-xl bg-white font-bold"
              >
                {roles.map((r) => (
                  <option key={r.role_key} value={r.role_key}>{r.title_fa}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allPerms.map((perm) => {
                const checked = selectedRoleKey === 'super_admin' || rolePermDraft.includes(perm);
                return (
                  <label
                    key={perm}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                      checked ? 'border-[#B11116] bg-[#FDF2F2]/60 font-bold' : 'border-[#E5E5E5]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={selectedRoleKey === 'super_admin'}
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRolePermDraft((prev) => [...prev, perm]);
                        } else {
                          setRolePermDraft((prev) => prev.filter((p) => p !== perm));
                        }
                      }}
                    />
                    <span>{PERMISSION_LABELS[perm] || perm}</span>
                  </label>
                );
              })}
            </div>

            {selectedRoleKey !== 'super_admin' && (
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/admin/roles/${selectedRoleKey}`, {
                    method: 'PUT',
                    body: JSON.stringify({ permissions: rolePermDraft }),
                  });
                  notify('ماتریس مجوزهای نقش ذخیره شد');
                  loadRbac();
                }}
                className="min-h-[44px] px-6 py-2.5 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] inline-flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره مجوزهای نقش</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // MODE 5: AUDIT LOGS
  // ========================
  if (mode === 'audit') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#B11116]" />
            <span>گزارش ممیزی و تاریخچه تغییر ناپذیر عملیات مدیران</span>
          </h1>
          <div className="flex gap-2">
            <input
              type="search"
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              placeholder="جستجو در جزئیات یا نام مدیر..."
              className="px-3.5 py-2 text-xs border border-[#E5E5E5] rounded-xl"
            />
            <button
              type="button"
              onClick={() => loadAudit(auditQuery)}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              جستجو
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#F0F0F0] text-xs">
          {auditLogs.map((l) => (
            <div key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[#111111]">{l.details}</div>
                <div className="text-[#525252]">
                  {l.user_name || 'سیستم'} · عملیات: <span dir="ltr">{l.action}</span>
                </div>
              </div>
              <span className="text-[#8C8C8C] tabular-nums">{formatPersianDate(l.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ========================
  // MODE 6: SETTINGS
  // ========================
  if (mode === 'settings') {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-5">
        <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#B11116]" />
          <span>مرکز تنظیمات فروشگاه، حساب بانکی، مالیات و سئو</span>
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {[
            { key: 'store_name', label: 'نام فروشگاه' },
            { key: 'store_phone', label: 'تلفن پشتیبانی B2B' },
            { key: 'store_email', label: 'ایمیل رسمی فروشگاه' },
            { key: 'free_shipping_threshold', label: 'سقف ارسال رایگان (تومان)' },
            { key: 'wholesale_default_discount_percent', label: 'درصد تخفیف پیش‌فرض عمده‌فروشی (٪)' },
            { key: 'tax_rate_percent', label: 'نرخ مالیات بر ارزش افزوده (٪)' },
            { key: 'bank_name', label: 'نام بانک کارت‌به‌کارت' },
            { key: 'bank_account_holder', label: 'نام صاحب حساب' },
            { key: 'bank_card_number', label: 'شماره کارت ۱۶ رقمی' },
            { key: 'bank_iban', label: 'شماره شبا (IBAN)' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block font-bold text-[#111111] mb-1.5">{f.label}</label>
              <input
                type="text"
                value={settings[f.key] || ''}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl focus:border-[#111111] focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="text-xs">
          <label className="block font-bold text-[#111111] mb-1.5">محتوای Robots.txt</label>
          <textarea
            rows={4}
            dir="ltr"
            value={settings.robots_txt || ''}
            onChange={(e) => setSettings({ ...settings, robots_txt: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl font-mono text-left"
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            await apiFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
            notify('تمام تنظیمات با موفقیت ذخیره شد');
          }}
          className="min-h-[48px] px-7 py-3 bg-[#B11116] text-white text-sm font-bold rounded-xl hover:bg-[#111111] cursor-pointer"
        >
          ذخیره کل تنظیمات
        </button>
      </div>
    );
  }

  // ========================
  // MODE 7: SYSTEM HEALTH & MAINTENANCE
  // ========================
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
          <Server className="w-5 h-5 text-[#B11116]" />
          <span>سلامت سیستم، فضای ذخیره‌سازی و نگهداری دیتابیس</span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const res = await apiFetch<{ message: string }>('/api/admin/system/maintenance', {
                method: 'POST',
                body: JSON.stringify({ action: 'optimize' }),
              });
              notify(res.message);
              loadHealth();
            }}
            className="min-h-[42px] px-4 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#B11116] cursor-pointer"
          >
            بهینه‌سازی ایندکس و کش
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await apiFetch<{ message: string }>('/api/admin/system/maintenance', {
                method: 'POST',
                body: JSON.stringify({ action: 'cleanup_sessions' }),
              });
              notify(res.message);
            }}
            className="min-h-[42px] px-4 py-2 border border-[#111111] text-[#111111] text-xs font-bold rounded-xl cursor-pointer"
          >
            پاکسازی نشست‌های منقضی‌شده
          </button>
        </div>
      </div>

      {systemHealth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
            <div className="text-[#525252]">وضعیت دیتابیس SQLite</div>
            <div className="text-sm font-extrabold text-[#1E6B4B]">{systemHealth.database.status}</div>
            <div className="text-[11px] text-[#525252] tabular-nums">
              حجم فایل: {toPersianDigits(Math.round(systemHealth.database.size_bytes / 1024))} کیلوبایت
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
            <div className="text-[#525252]">حافظه و زمان فعالیت سرور</div>
            <div className="text-sm font-extrabold text-[#111111] tabular-nums">
              {toPersianDigits(systemHealth.runtime.memory_mb)} مگابایت RAM
            </div>
            <div className="text-[11px] text-[#525252] tabular-nums">
              Node {systemHealth.runtime.node_version} · Uptime: {toPersianDigits(systemHealth.runtime.uptime_seconds)} ثانیه
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
            <div className="text-[#525252]">فضای تصاویر آپلودشده</div>
            <div className="text-sm font-extrabold text-[#111111] tabular-nums">
              {toPersianDigits(systemHealth.storage.media_files_count)} فایل روی دیسک
            </div>
            <div className="text-[11px] text-[#1E6B4B]">
              {systemHealth.storage.media_dir_ready ? 'پوشه رسانه آماده و متصل' : 'نیازمند بررسی'}
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-1">
            <div className="text-[#525252]">آمار کل رکوردها</div>
            <div className="text-sm font-extrabold text-[#111111] tabular-nums">
              {toPersianDigits(systemHealth.counts.products)} محصول · {toPersianDigits(systemHealth.counts.orders)} سفارش
            </div>
            <div className="text-[11px] text-[#525252] tabular-nums">
              {toPersianDigits(systemHealth.counts.navigation_items)} آیتم منو · {toPersianDigits(systemHealth.counts.activity_logs)} لاگ
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
