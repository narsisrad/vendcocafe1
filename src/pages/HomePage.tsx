import React, { useEffect, useState } from 'react';
import { ArrowLeft, Coffee, PackageCheck, ShieldCheck, Truck, Clock } from 'lucide-react';
import { apiFetch, formatPersianDate, toPersianDigits } from '../lib/format';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { ProductCard } from '../components/ProductCard';
import { AppLink } from '../components/AppLink';
import { BlogPost, Category, Product } from '../types';

interface HomeSectionConfig {
  key: 'hero' | 'categories' | 'bestsellers' | 'blog';
  title?: string;
  visible?: boolean;
}

interface HomeData {
  categories: Category[];
  bestsellers: Product[];
  featured: Product[];
  blog_posts: BlogPost[];
  sections?: HomeSectionConfig[];
  hero?: {
    kicker?: string;
    title?: string;
    subtitle?: string;
    image?: string;
    cta_label?: string;
  };
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<HomeData>('/api/storefront/home')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-12 space-y-10 animate-pulse">
        <div className="h-[420px] bg-[#E5E5E5] rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-[#E5E5E5] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const defaultSections: HomeSectionConfig[] = [
    { key: 'hero', visible: true },
    { key: 'categories', title: 'دسته‌بندی‌های تخصصی کافه', visible: true },
    { key: 'bestsellers', title: 'پرفروش‌ترین ملزومات کافی‌شاپ', visible: true },
    { key: 'blog', title: 'آکادمی و راهنمای فنی باریستا', visible: true },
  ];
  const orderedSections =
    data?.sections && data.sections.length > 0 ? data.sections : defaultSections;

  const hero = {
    kicker: data?.hero?.kicker || 'تامین مستقیم کافه‌ها و رستری‌ها · ارسال روزانه',
    title: data?.hero?.title || 'ملزومات تخصصی کافی‌شاپ با کیفیت تجاری و قیمت عمده',
    subtitle:
      data?.hero?.subtitle ||
      'از دان قهوه اسپرسو تازه رُست و سیروپ‌های کافه‌ای تا لیوان دوجداره بیرون‌بر، فیلتر دمی و شوینده‌های استاندارد ماشین اسپرسو؛ همه یکجا با موجودی لحظه‌ای انبار.',
    image: data?.hero?.image || 'hero_coffee_roastery',
    cta_label: data?.hero?.cta_label || 'مشاهده کاتالوگ محصولات',
  };

  const renderSection = (sec: HomeSectionConfig) => {
    if (sec.visible === false) return null;

    if (sec.key === 'hero') {
      return (
        <section key="hero" className="max-w-[1320px] mx-auto px-4 lg:px-6 pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden items-stretch shadow-xs">
            <div className="lg:col-span-5 p-8 lg:p-12 flex flex-col justify-center gap-6">
              <p className="text-xs font-semibold text-[#B11116] tracking-wide">{hero.kicker}</p>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-[#111111] leading-tight">
                {hero.title}
              </h1>
              <p className="text-sm lg:text-base text-[#525252] leading-relaxed">
                {hero.subtitle}
              </p>
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <AppLink
                  to="/products"
                  className="min-h-[52px] px-7 py-3.5 bg-[#B11116] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#8E0D11] transition-colors duration-200 inline-flex items-center justify-center gap-2.5"
                >
                  <span>{hero.cta_label}</span>
                  <ArrowLeft className="w-5 h-5" />
                </AppLink>
                <AppLink
                  to="/contact"
                  className="min-h-[52px] px-7 py-3.5 bg-[#111111] text-white text-sm sm:text-base font-bold rounded-xl hover:bg-[#262626] transition-colors duration-200 inline-flex items-center justify-center gap-2.5"
                >
                  <span>مشاوره و خرید عمده</span>
                </AppLink>
              </div>
            </div>
            <div className="lg:col-span-7 relative min-h-[320px] lg:min-h-[450px] bg-white border-r border-[#F0F0F0]">
              <img
                src={resolveMediaUrl(hero.image)}
                alt={hero.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <AppLink
              to="/shipping-policy"
              className="group bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center gap-3 hover:border-[#B11116] hover:shadow-sm transition-all"
            >
              <Truck className="w-5 h-5 text-[#B11116] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#111111] group-hover:text-[#B11116] transition-colors">
                  ارسال فوری کافه‌های تهران
                </div>
                <div className="text-[11px] text-[#666666]">تحویل زیر ۳ ساعت با پیک اختصاصی</div>
              </div>
            </AppLink>
            <AppLink
              to="/products"
              className="group bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center gap-3 hover:border-[#B11116] hover:shadow-sm transition-all"
            >
              <PackageCheck className="w-5 h-5 text-[#B11116] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#111111] group-hover:text-[#B11116] transition-colors">
                  فروش در واحدهای کارگاهی
                </div>
                <div className="text-[11px] text-[#666666]">بسته‌های ۵۰ عددی، کیلوگرمی و کارتن</div>
              </div>
            </AppLink>
            <AppLink
              to="/return-policy"
              className="group bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center gap-3 hover:border-[#B11116] hover:shadow-sm transition-all"
            >
              <ShieldCheck className="w-5 h-5 text-[#B11116] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#111111] group-hover:text-[#B11116] transition-colors">
                  تضمین اصالت و تازگی رُست
                </div>
                <div className="text-[11px] text-[#666666]">تاریخ برشته‌کاری درج‌شده روی پاکت</div>
              </div>
            </AppLink>
            <AppLink
              to="/faq"
              className="group bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center gap-3 hover:border-[#B11116] hover:shadow-sm transition-all"
            >
              <Coffee className="w-5 h-5 text-[#B11116] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#111111] group-hover:text-[#B11116] transition-colors">
                  پرداخت آنلاین و کارت‌به‌کارت
                </div>
                <div className="text-[11px] text-[#666666]">همراه با صدور فاکتور رسمی خرید</div>
              </div>
            </AppLink>
          </div>
        </section>
      );
    }

    if (sec.key === 'categories' && data && data.categories.length > 0) {
      return (
        <section key="categories" className="max-w-[1320px] mx-auto px-4 lg:px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-[#111111]">
                {sec.title || 'دسته‌بندی‌های تخصصی کافه'}
              </h2>
              <p className="text-xs lg:text-sm text-[#595959] mt-1">
                دسترسی سریع به مواد اولیه و لوازم مصرفی استاندارد بار سرد و گرم
              </p>
            </div>
            <AppLink
              to="/products"
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5E5E5] bg-white text-sm font-bold text-[#111111] hover:border-[#B11116] hover:text-[#B11116] inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span>همه دسته‌ها</span>
              <ArrowLeft className="w-4 h-4" />
            </AppLink>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {data.categories.map((cat) => (
              <AppLink
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="group bg-white border border-[#E5E5E5] rounded-xl p-3 text-center hover:border-[#B11116] hover:-translate-y-0.5 hover:shadow-sm transition-all flex flex-col items-center gap-2.5"
              >
                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-[#F5F5F5]">
                  <img
                    src={resolveMediaUrl(cat.image_key)}
                    alt={cat.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#111111] group-hover:text-[#B11116] line-clamp-1 transition-colors">
                    {cat.name}
                  </div>
                  <div className="text-[11px] text-[#666666] mt-0.5 tabular-nums">
                    {toPersianDigits(cat.product_count || 0)} کالا
                  </div>
                </div>
              </AppLink>
            ))}
          </div>
        </section>
      );
    }

    if (sec.key === 'bestsellers' && data && data.bestsellers.length > 0) {
      return (
        <section key="bestsellers" className="max-w-[1320px] mx-auto px-4 lg:px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-[#111111]">
                {sec.title || 'پرفروش‌ترین ملزومات کافی‌شاپ'}
              </h2>
              <p className="text-xs lg:text-sm text-[#595959] mt-1">
                پرکاربردترین اقلام روزانه کافه‌ها با موجودی مستقیم انبار و قیمت به‌روز
              </p>
            </div>
            <AppLink
              to="/products?sort=bestselling"
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5E5E5] bg-white text-sm font-bold text-[#111111] hover:border-[#B11116] hover:text-[#B11116] inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span>مشاهده همه کالاها</span>
              <ArrowLeft className="w-4 h-4" />
            </AppLink>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.bestsellers.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </section>
      );
    }

    if (sec.key === 'blog' && data && data.blog_posts.length > 0) {
      return (
        <section key="blog" className="max-w-[1320px] mx-auto px-4 lg:px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-[#111111]">
                {sec.title || 'آکادمی و راهنمای فنی باریستا'}
              </h2>
              <p className="text-xs lg:text-sm text-[#595959] mt-1">
                نکات عملی عصاره‌گیری، نگهداری دستگاه اسپرسو و مدیریت هزینه کافی‌شاپ
              </p>
            </div>
            <AppLink
              to="/blog"
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5E5E5] bg-white text-sm font-bold text-[#111111] hover:border-[#B11116] hover:text-[#B11116] inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <span>آرشیو مقالات</span>
              <ArrowLeft className="w-4 h-4" />
            </AppLink>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.blog_posts.map((post) => (
              <AppLink
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group bg-white border border-[#E5E5E5] rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-5 hover:border-[#B11116] hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <div className="sm:col-span-2 bg-[#F5F5F5] aspect-[4/3] sm:aspect-auto overflow-hidden">
                  <img
                    src={resolveMediaUrl(post.cover_image)}
                    alt={post.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="sm:col-span-3 p-5 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#666666] mb-2">
                      <span>{post.category_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {toPersianDigits(post.read_time_min)} دقیقه مطالعه
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#111111] group-hover:text-[#B11116] transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs text-[#595959] mt-2 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="text-[11px] text-[#8C8C8C]">
                    {formatPersianDate(post.published_at)}
                  </div>
                </div>
              </AppLink>
            ))}
          </div>
        </section>
      );
    }

    return null;
  };

  return <div className="space-y-16">{orderedSections.map(renderSection)}</div>;
}
