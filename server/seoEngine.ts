import { db } from './db.ts';

export interface SeoAuditCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'good' | 'warning' | 'error';
  message: string;
  points: number;
  maxPoints: number;
}

export interface SeoAuditResult {
  score: number;
  checks: SeoAuditCheck[];
}

export function analyzeSeoContent(input: {
  url_path: string;
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
  content_text?: string;
  has_image?: boolean;
  robots_index?: boolean;
  canonical_url?: string | null;
  schema_type?: string;
  custom_json_ld?: string | null;
  entity_id?: number;
}): SeoAuditResult {
  const checks: SeoAuditCheck[] = [];
  const kw = (input.focus_keyword || '').trim().toLowerCase();
  const title = (input.seo_title || '').trim();
  const desc = (input.meta_description || '').trim();
  const content = (input.content_text || '').trim();
  const url = (input.url_path || '').trim().toLowerCase();

  // 1. Focus keyword set
  const hasKw = kw.length >= 2;
  checks.push({
    id: 'focus_kw',
    label: 'تعیین کلمه کلیدی کانونی',
    passed: hasKw,
    severity: hasKw ? 'good' : 'error',
    message: hasKw ? `کلمه کلیدی «${input.focus_keyword}» تعریف شده است.` : 'کلمه کلیدی کانونی مشخص نشده است.',
    points: hasKw ? 10 : 0,
    maxPoints: 10,
  });

  // 2. Focus keyword in SEO title
  const kwInTitle = hasKw && title.toLowerCase().includes(kw);
  checks.push({
    id: 'kw_in_title',
    label: 'کلمه کلیدی در عنوان سئو',
    passed: kwInTitle,
    severity: kwInTitle ? 'good' : 'error',
    message: kwInTitle ? 'کلمه کلیدی در عنوان سئو وجود دارد.' : 'کلمه کلیدی کانونی در عنوان سئو دیده نمی‌شود.',
    points: kwInTitle ? 15 : 0,
    maxPoints: 15,
  });

  // 3. SEO Title Length (35-65 chars optimal)
  const titleLenOk = title.length >= 30 && title.length <= 65;
  checks.push({
    id: 'title_length',
    label: 'طول استاندارد عنوان سئو',
    passed: titleLenOk,
    severity: titleLenOk ? 'good' : 'warning',
    message: `طول عنوان ${title.length} کاراکتر است (بازه پیشنهادی ۳۰ تا ۶۵ کاراکتر).`,
    points: titleLenOk ? 10 : title.length > 0 ? 5 : 0,
    maxPoints: 10,
  });

  // 4. Focus keyword in meta description
  const kwInDesc = hasKw && desc.toLowerCase().includes(kw);
  checks.push({
    id: 'kw_in_desc',
    label: 'کلمه کلیدی در توضیحات متا',
    passed: kwInDesc,
    severity: kwInDesc ? 'good' : 'warning',
    message: kwInDesc ? 'کلمه کلیدی در متا دیسکریپشن به کار رفته است.' : 'توصیه می‌شود کلمه کلیدی را در توضیحات متا درج کنید.',
    points: kwInDesc ? 12 : 0,
    maxPoints: 12,
  });

  // 5. Meta Description Length (90-165 chars)
  const descLenOk = desc.length >= 80 && desc.length <= 165;
  checks.push({
    id: 'desc_length',
    label: 'طول استاندارد متا دیسکریپشن',
    passed: descLenOk,
    severity: descLenOk ? 'good' : 'warning',
    message: `طول توضیحات متا ${desc.length} کاراکتر است (بازه پیشنهادی ۸۰ تا ۱۶۵ کاراکتر).`,
    points: descLenOk ? 10 : desc.length > 0 ? 4 : 0,
    maxPoints: 10,
  });

  // 6. Keyword in URL or clean ASCII slug
  const cleanUrl = /^\/[a-z0-9\-\/]*$/.test(url);
  checks.push({
    id: 'clean_url',
    label: 'ساختار استاندارد و تمیز URL',
    passed: cleanUrl,
    severity: cleanUrl ? 'good' : 'warning',
    message: cleanUrl ? 'آدرس URL کوتاه، خوانا و استاندارد است.' : 'آدرس صفحه باید تنها شامل حروف لاتین کوچک و خط تیره باشد.',
    points: cleanUrl ? 8 : 3,
    maxPoints: 8,
  });

  // 7. Content depth & keyword density
  const words = content.split(/\s+/).filter(Boolean);
  const contentOk = words.length >= 30;
  checks.push({
    id: 'content_length',
    label: 'غنای محتوایی صفحه',
    passed: contentOk,
    severity: contentOk ? 'good' : 'warning',
    message: `متن صفحه دارای ${words.length} واژه است.`,
    points: contentOk ? 10 : words.length > 10 ? 5 : 2,
    maxPoints: 10,
  });

  // 8. Duplicate Title Detection
  const dupTitle = db.prepare(
    'SELECT COUNT(*) as cnt FROM seo_metadata WHERE seo_title = ? AND url_path != ?'
  ).get(title, input.url_path) as { cnt: number };
  const noDupTitle = dupTitle.cnt === 0;
  checks.push({
    id: 'unique_title',
    label: 'یکتا بودن عنوان سئو در کل سایت',
    passed: noDupTitle,
    severity: noDupTitle ? 'good' : 'error',
    message: noDupTitle ? 'هیچ صفحه تکراری با این عنوان در سامانه ثبت نشده است.' : 'هشدار: عنوان سئو با صفحه دیگری تکراری است.',
    points: noDupTitle ? 10 : 0,
    maxPoints: 10,
  });

  // 9. Indexability & Canonical
  const indexable = input.robots_index !== false;
  checks.push({
    id: 'indexability',
    label: 'وضعیت ایندکس‌پذیری ربات‌ها',
    passed: indexable,
    severity: indexable ? 'good' : 'warning',
    message: indexable ? 'صفحه با دستور Index در موتورهای جستجو قابل ثبت است.' : 'این صفحه روی حالت Noindex تنظیم شده است.',
    points: indexable ? 7 : 3,
    maxPoints: 7,
  });

  // 10. Structured Data (JSON-LD)
  let schemaValid = Boolean(input.schema_type);
  if (input.custom_json_ld) {
    try {
      JSON.parse(input.custom_json_ld);
    } catch {
      schemaValid = false;
    }
  }
  checks.push({
    id: 'schema_valid',
    label: 'ساختار داده استاندارد (JSON-LD)',
    passed: schemaValid,
    severity: schemaValid ? 'good' : 'error',
    message: schemaValid ? `اسکیما نوع ${input.schema_type || 'WebPage'} معتبر و فعال است.` : 'ساختار JSON-LD سفارشی نامعتبر است.',
    points: schemaValid ? 8 : 0,
    maxPoints: 8,
  });

  const score = Math.min(100, checks.reduce((sum, c) => sum + c.points, 0));
  return { score, checks };
}

export function buildJsonLdForUrl(urlPath: string, baseUrl: string): Record<string, unknown>[] {
  const seo = db.prepare('SELECT * FROM seo_metadata WHERE url_path = ?').get(urlPath) as any;
  const storeNameRow = db.prepare("SELECT value FROM settings WHERE key = 'store_name'").get() as { value: string } | undefined;
  const storeName = storeNameRow?.value || 'BaristaPro - ملزومات تخصصی کافی‌شاپ';

  const schemas: Record<string, unknown>[] = [];

  if (urlPath === '/') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: storeName,
      url: baseUrl,
      sameAs: [],
    });
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: storeName,
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });
  }

  if (urlPath.startsWith('/product/')) {
    const slug = urlPath.replace('/product/', '');
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.slug = ? AND p.is_published = 1
    `).get(slug) as any;

    if (product) {
      const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1').all(product.id) as any[];
      const prices = variants.map((v) => v.discount_price || v.regular_price);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const totalStock = variants.reduce((s, v) => s + Math.max(0, v.stock_quantity - v.reserved_quantity), 0);

      // Only real approved reviews, never fake ratings
      const ratingAgg = db.prepare(
        'SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE product_id = ? AND is_approved = 1'
      ).get(product.id) as { count: number; avg_rating: number | null };

      const productSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: product.short_description,
        sku: product.sku,
        brand: product.brand_name ? { '@type': 'Brand', name: product.brand_name } : undefined,
        offers: variants.length > 1
          ? {
              '@type': 'AggregateOffer',
              priceCurrency: 'IRR',
              lowPrice: minPrice * 10,
              highPrice: maxPrice * 10,
              offerCount: variants.length,
              availability: totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            }
          : {
              '@type': 'Offer',
              priceCurrency: 'IRR',
              price: minPrice * 10,
              availability: totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: `${baseUrl}${urlPath}`,
            },
      };

      if (ratingAgg && ratingAgg.count > 0 && ratingAgg.avg_rating) {
        productSchema.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: Number(ratingAgg.avg_rating.toFixed(1)),
          reviewCount: ratingAgg.count,
        };
      }

      schemas.push(productSchema);
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: baseUrl },
          { '@type': 'ListItem', position: 2, name: product.category_name, item: `${baseUrl}/category/${product.category_slug}` },
          { '@type': 'ListItem', position: 3, name: product.title, item: `${baseUrl}${urlPath}` },
        ],
      });
    }
  } else if (urlPath.startsWith('/blog/')) {
    const slug = urlPath.replace('/blog/', '');
    const post = db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1').get(slug) as any;
    if (post) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        datePublished: post.published_at,
        author: { '@type': 'Organization', name: storeName },
      });
    }
  } else if (urlPath === '/faq') {
    const faqs = db.prepare('SELECT * FROM faqs ORDER BY display_order ASC').all() as any[];
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  if (seo?.custom_json_ld) {
    try {
      const parsed = JSON.parse(seo.custom_json_ld);
      schemas.push(parsed);
    } catch {
      // ignore invalid custom json-ld
    }
  }

  return schemas;
}

export function generateSitemapIndexXml(baseUrl: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-categories.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-products.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-blog.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;
}

export function generateSubSitemapXml(type: 'pages' | 'categories' | 'products' | 'blog', baseUrl: string): string {
  const urls: { loc: string; lastmod?: string; priority: string; changefreq: string }[] = [];

  if (type === 'pages') {
    const staticPaths = ['/', '/products', '/blog', '/about', '/contact', '/faq', '/shipping-policy', '/return-policy'];
    for (const p of staticPaths) {
      const seo = db.prepare('SELECT robots_index, updated_at FROM seo_metadata WHERE url_path = ?').get(p) as any;
      if (!seo || seo.robots_index !== 0) {
        urls.push({ loc: `${baseUrl}${p}`, lastmod: seo?.updated_at, priority: p === '/' ? '1.0' : '0.7', changefreq: 'weekly' });
      }
    }
  } else if (type === 'categories') {
    const cats = db.prepare('SELECT slug FROM categories WHERE is_active = 1').all() as any[];
    for (const c of cats) {
      const path = `/category/${c.slug}`;
      const seo = db.prepare('SELECT robots_index, updated_at FROM seo_metadata WHERE url_path = ?').get(path) as any;
      if (!seo || seo.robots_index !== 0) {
        urls.push({ loc: `${baseUrl}${path}`, lastmod: seo?.updated_at, priority: '0.8', changefreq: 'weekly' });
      }
    }
  } else if (type === 'products') {
    const prods = db.prepare('SELECT slug, updated_at FROM products WHERE is_published = 1').all() as any[];
    for (const p of prods) {
      const path = `/product/${p.slug}`;
      const seo = db.prepare('SELECT robots_index, updated_at FROM seo_metadata WHERE url_path = ?').get(path) as any;
      if (!seo || seo.robots_index !== 0) {
        urls.push({ loc: `${baseUrl}${path}`, lastmod: p.updated_at, priority: '0.9', changefreq: 'daily' });
      }
    }
  } else if (type === 'blog') {
    const posts = db.prepare('SELECT slug, published_at FROM blog_posts WHERE is_published = 1').all() as any[];
    for (const b of posts) {
      const path = `/blog/${b.slug}`;
      const seo = db.prepare('SELECT robots_index, updated_at FROM seo_metadata WHERE url_path = ?').get(path) as any;
      if (!seo || seo.robots_index !== 0) {
        urls.push({ loc: `${baseUrl}${path}`, lastmod: b.published_at, priority: '0.7', changefreq: 'monthly' });
      }
    }
  }

  const itemsXml = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${itemsXml}
</urlset>`;
}
