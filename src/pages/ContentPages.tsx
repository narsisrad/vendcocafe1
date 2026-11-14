import React, { useEffect, useState } from 'react';
import { Clock, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch, formatPersianDate, toPersianDigits } from '../lib/format';
import { resolveMediaUrl } from '../lib/mediaRegistry';
import { AppLink } from '../components/AppLink';
import { BlogPost } from '../types';

export function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    apiFetch<{ posts: BlogPost[] }>('/api/blog').then((r) => setPosts(r.posts));
  }, []);

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#111111]">آکادمی باریستا و مدیریت کافی‌شاپ</h1>
        <p className="text-sm text-[#595959] mt-1">مقالات آموزشی و فنی درباره عصاره‌گیری اسپرسو، نگهداری دستگاه و بسته‌بندی بیرون‌بر</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <AppLink
            key={post.id}
            to={`/blog/${post.slug}`}
            className="group bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden hover:border-[#B11116] hover:-translate-y-0.5 hover:shadow-md transition-all block"
          >
            <div className="overflow-hidden bg-[#F8F8F8]">
              <img
                src={resolveMediaUrl(post.cover_image)}
                alt={post.title}
                className="w-full aspect-[16/9] object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#666666]">
                <span>{post.category_name}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {toPersianDigits(post.read_time_min)} دقیقه مطالعه
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#111111] group-hover:text-[#B11116] transition-colors">{post.title}</h2>
              <p className="text-sm text-[#595959] leading-relaxed">{post.excerpt}</p>
            </div>
          </AppLink>
        ))}
      </div>
    </div>
  );
}

export function BlogDetailPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    apiFetch<{ post: BlogPost }>(`/api/blog/${slug}`).then((r) => setPost(r.post)).catch(() => setPost(null));
  }, [slug]);

  if (!post) return <div className="max-w-3xl mx-auto px-4 py-16 text-center">مقاله یافت نشد.</div>;

  return (
    <article className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <AppLink to="/blog" className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl border border-[#E5E5E5] text-sm font-bold text-[#111111] hover:border-[#B11116] hover:text-[#B11116] transition-colors">
        <ArrowRight className="w-4 h-4" /> بازگشت به آکادمی باریستا
      </AppLink>
      <div className="space-y-3">
        <div className="text-xs text-[#666666]">
          {post.category_name} · {formatPersianDate(post.published_at)} · {toPersianDigits(post.read_time_min)} دقیقه مطالعه
        </div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-[#111111] leading-snug">{post.title}</h1>
      </div>
      <img src={resolveMediaUrl(post.cover_image)} alt={post.title} className="w-full aspect-[16/9] object-cover rounded-2xl border border-[#E5E5E5]" />
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 lg:p-8 text-base text-[#111111] leading-loose whitespace-pre-line">
        {post.content}
      </div>
    </article>
  );
}

export function FaqPage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openId, setOpenId] = useState<number | null>(1);

  useEffect(() => {
    apiFetch<{ faqs: any[] }>('/api/faqs').then((r) => setFaqs(r.faqs));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#111111]">سوالات متداول خریداران و کافه‌داران</h1>
        <p className="text-sm text-[#595959] mt-1">پاسخ به پرسش‌های پرتکرار درباره ثبت سفارش عمده، پرداخت و ارسال مرسولات</p>
      </div>
      <div className="space-y-3">
        {faqs.map((f) => {
          const isOpen = openId === f.id;
          return (
            <div key={f.id} className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : f.id)}
                className="w-full min-h-[56px] p-5 text-right flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-[#111111] hover:text-[#B11116] transition-colors cursor-pointer"
              >
                <span>{f.question}</span>
                {isOpen ? <ChevronUp className="w-5 h-5 shrink-0 text-[#B11116]" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm text-[#525252] leading-relaxed border-t border-[#F0F0F0] pt-3.5">
                  {f.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StaticPage({ type }: { type: 'about' | 'contact' | 'shipping' | 'return' | 'privacy' | 'terms' }) {
  const contentMap: Record<string, { title: string; body: string }> = {
    about: {
      title: 'درباره سامانه تامین ملزومات کافی‌شاپ باریستاپرو',
      body: 'باریستاپرو به عنوان مرجع تخصصی زنجیره تامین کافی‌شاپ‌ها، کافه‌رستری‌ها و هتل‌ها فعالیت می‌کند. هدف ما حذف واسطه‌های متعدد و ارائه مستقیم دان قهوه تازه رُست، سیروپ‌های اورجینال، لیوان‌های دوجداره فودگرید و ابزار کالیبره باریستا با قیمت شفاف و تحویل به‌موقع است.',
    },
    contact: {
      title: 'تماس با واحد فروش و پشتیبانی باریستاپرو',
      body: 'دفتر مرکزی و انبار توزیع: تهران، خیابان سهروردی شمالی، پلاک ۱۸۴\nتلفن تماس واحد فروش سازمانی: ۰۲۱-۸۸۴۵۹۲۱۰\nایمیل پشتیبانی: sales@baristapro.ir\nساعات پاسخگویی: شنبه تا پنج‌شنبه از ساعت ۹ الی ۱۹',
    },
    shipping: {
      title: 'رویه ارسال سفارش‌ها، پیک تهران و باربری',
      body: 'سفارش‌های ثبت‌شده در شهر تهران بالای مبلغ ۵ میلیون تومان شامل ارسال رایگان با پیک اختصاصی هستند. مرسولات شهرستان از طریق تیپاکس یا باربری‌های مجاز با بسته‌بندی چندلایه مقاوم در برابر ضربه و رطوبت ارسال می‌شوند.',
    },
    return: {
      title: 'ضمانت اصالت و شرایط بازگرداندن کالا',
      body: 'تمامی کالاهای بسته‌بندی‌شده تا ۷ روز پس از تحویل در صورت حفظ پلمب بهداشتی و عدم آسیب فیزیکی قابل بازگشت هستند. در مورد دان قهوه، تاریخ رُست حداکثر ۱۴ روز پیش از ارسال تضمین می‌شود.',
    },
    privacy: {
      title: 'حریم خصوصی مشتریان و امنیت اطلاعات',
      body: 'اطلاعات تماس، نشانی شعب کافی‌شاپ و فیش‌های بانکی بارگذاری‌شده در باریستاپرو به‌صورت رمزنگاری‌شده و محرمانه نگهداری شده و صرفاً جهت پردازش سفارش و صدور فاکتور استفاده می‌شوند.',
    },
    terms: {
      title: 'شرایط و قوانین استفاده از باریستاپرو',
      body: 'ثبت سفارش به منزله مطالعه و تایید مشخصات فنی، حداقل تعداد سفارش و واحد شمارش (مانند مضارب ۵۰ عددی لیوان کاغذی) است. قیمت‌ها و موجودی انبار به‌صورت لحظه‌ای در سرور محاسبه می‌شوند.',
    },
  };
  const info = contentMap[type];
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 space-y-4">
        <h1 className="text-2xl font-extrabold text-[#111111]">{info.title}</h1>
        <p className="text-sm text-[#595959] leading-loose whitespace-pre-line">{info.body}</p>
      </div>
    </div>
  );
}
