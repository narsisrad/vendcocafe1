import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db, initSchema, withTransaction, UPLOAD_RECEIPTS_DIR, UPLOAD_MEDIA_DIR } from './server/db.ts';
import { seedDatabaseIfEmpty, hashPassword, verifyPassword } from './server/seed.ts';
import {
  analyzeSeoContent,
  buildJsonLdForUrl,
  generateSitemapIndexXml,
  generateSubSitemapXml,
} from './server/seoEngine.ts';
import {
  getOrCreateCart,
  mergeGuestCartToUser,
  getCartSummary,
  validateAndNormalizeQuantity,
  createOrderFromCart,
  verifyOnlineGatewayPayment,
  reviewBankTransferReceipt,
  logActivity,
  getSetting,
  isUserWholesaleApproved,
  getEffectiveVariantPrice,
} from './server/services.ts';
import {
  getUserPermissions,
  registerEnterpriseAdminRoutes,
} from './server/adminRoutes.ts';

initSchema();
seedDatabaseIfEmpty();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set('trust proxy', 1);

function getCookieOptions(req: Request, maxAgeMs: number) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    ...(isHttps ? { partitioned: true } : {}),
    maxAge: maxAgeMs,
  } as any;
}

app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

// Multer config for secure bank transfer receipt uploads
const receiptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_RECEIPTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `receipt-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل فیش مجاز نیست. فقط JPG، PNG، WEBP یا PDF مجاز است.'));
    }
  },
});

// Guest & Auth Context Middleware
interface AuthedRequest extends Request {
  user?: any;
  guestToken?: string;
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

function attachSession(req: AuthedRequest, res: Response, next: NextFunction) {
  const headerGuest = typeof req.headers['x-guest-token'] === 'string' ? req.headers['x-guest-token'].trim() : '';
  let guestToken = headerGuest.length >= 16 ? headerGuest : req.cookies?.bp_guest;
  if (!guestToken || typeof guestToken !== 'string' || guestToken.length < 16) {
    guestToken = crypto.randomBytes(18).toString('hex');
    res.cookie('bp_guest', guestToken, getCookieOptions(req, 30 * 24 * 60 * 60 * 1000));
  }
  req.guestToken = guestToken;

  const sessionToken = extractBearerToken(req) || req.cookies?.bp_session;
  if (sessionToken) {
    const row = db.prepare(`
      SELECT u.id, u.name, u.mobile, u.email, u.role, u.admin_role_key, u.status, u.cafe_name, u.customer_group, u.wholesale_status
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now') AND u.status = 'active'
    `).get(sessionToken) as any;
    if (row) {
      req.user = {
        ...row,
        permissions: getUserPermissions(row),
      };
    }
  }
  next();
}

app.use(attachSession);

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
    res.status(403).json({ error: 'دسترسی غیرمجاز. این بخش ویژه مدیران فروشگاه است.' });
    return;
  }
  next();
}

function requirePermission(perm: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
      res.status(403).json({ error: 'دسترسی غیرمجاز.' });
      return;
    }
    const perms: string[] = req.user.permissions || getUserPermissions(req.user);
    if (perms.includes('*') || perms.includes(perm)) {
      next();
      return;
    }
    res.status(403).json({ error: `شما مجوز انجام این عملیات (${perm}) را ندارید.` });
  };
}

// SEO Redirect Middleware (301 / 302) for page navigation
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/src') || req.path.includes('.')) {
    next();
    return;
  }
  const redir = db.prepare('SELECT * FROM seo_redirects WHERE source_path = ? AND is_active = 1').get(req.path) as any;
  if (redir) {
    db.prepare('UPDATE seo_redirects SET hits = hits + 1 WHERE id = ?').run(redir.id);
    res.redirect(redir.status_code, redir.target_path);
    return;
  }
  next();
});

// ========================
// AUTH ROUTES
// ========================
app.post('/api/auth/register', (req: AuthedRequest, res) => {
  const { name, mobile, email, password, cafe_name } = req.body || {};
  if (!name?.trim() || !mobile?.trim() || !password || password.length < 6) {
    res.status(400).json({ error: 'نام، شماره موبایل و رمز عبور (حداقل ۶ کاراکتر) الزامی است.' });
    return;
  }
  const cleanMobile = mobile.trim();
  const exists = db.prepare('SELECT id FROM users WHERE mobile = ?').get(cleanMobile);
  if (exists) {
    res.status(409).json({ error: 'این شماره موبایل قبلاً ثبت‌نام کرده است.' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO users (name, mobile, email, password_hash, role, status, cafe_name)
    VALUES (?, ?, ?, ?, 'customer', 'active', ?)
  `).run(name.trim(), cleanMobile, email?.trim() || null, hashPassword(password), cafe_name?.trim() || null);

  const userId = Number(result.lastInsertRowid);
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+14 days'))").run(token, userId);

  mergeGuestCartToUser(req.guestToken || null, userId);

  res.cookie('bp_session', token, getCookieOptions(req, 14 * 24 * 60 * 60 * 1000));
  const user = db.prepare('SELECT id, name, mobile, email, role, cafe_name FROM users WHERE id = ?').get(userId);
  res.json({ user, token });
});

app.post('/api/auth/login', (req: AuthedRequest, res) => {
  const { mobile, password } = req.body || {};
  if (!mobile?.trim() || !password) {
    res.status(400).json({ error: 'شماره موبایل یا ایمیل و رمز عبور را وارد کنید.' });
    return;
  }
  const identifier = mobile.trim();
  const user = db.prepare('SELECT * FROM users WHERE mobile = ? OR email = ?').get(identifier, identifier) as any;
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'شماره موبایل یا رمز عبور نادرست است.' });
    return;
  }
  if (user.status === 'blocked') {
    res.status(403).json({ error: 'حساب کاربری شما مسدود شده است. با پشتیبانی تماس بگیرید.' });
    return;
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+14 days'))").run(token, user.id);
  mergeGuestCartToUser(req.guestToken || null, user.id);

  res.cookie('bp_session', token, getCookieOptions(req, 14 * 24 * 60 * 60 * 1000));
  const perms = getUserPermissions(user);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      admin_role_key: user.admin_role_key,
      cafe_name: user.cafe_name,
      customer_group: user.customer_group,
      wholesale_status: user.wholesale_status,
      permissions: perms,
    },
    token,
  });
});

app.post('/api/auth/logout', (req: AuthedRequest, res) => {
  const token = extractBearerToken(req) || req.cookies?.bp_session;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  const opts = getCookieOptions(req, 0);
  res.clearCookie('bp_session', opts);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  res.json({ user: req.user || null, guestToken: req.guestToken });
});

// Public Media Image Serving
app.get('/api/media/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_MEDIA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'تصویر یافت نشد.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Public Storefront Navigation (Header + Mobile Hamburger Drawer + Footer)
app.get('/api/storefront/navigation', (_req, res) => {
  const items = db.prepare(`
    SELECT * FROM navigation_items WHERE is_active = 1 ORDER BY display_order ASC, id ASC
  `).all() as any[];

  const header = items.filter((i) => i.location === 'header' || i.location === 'both');
  const mobile_drawer = items.filter((i) => i.location === 'mobile_drawer' || i.location === 'both');
  const footer = items.filter((i) => i.location === 'footer');

  const showBestsellers = getSetting('hamburger_show_bestsellers', '1') === '1';
  const bestsellers = showBestsellers
    ? db.prepare(`
        SELECT id, title, slug, main_image
        FROM products WHERE is_published = 1
        ORDER BY is_bestseller DESC, sales_count DESC
        LIMIT 5
      `).all()
    : [];

  res.json({
    header,
    mobile_drawer,
    footer,
    hamburger_bestsellers: bestsellers,
    hamburger_show_bestsellers: showBestsellers,
  });
});

// ========================
// PUBLIC STOREFRONT & CATALOG
// ========================
app.get('/api/storefront/home', (req: AuthedRequest, res) => {
  const isWholesale = isUserWholesaleApproved(req.user?.id);
  const categories = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_published = 1) as product_count
    FROM categories c WHERE c.is_active = 1 ORDER BY c.display_order ASC
  `).all();

  const brands = db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY id ASC').all();

  const attachDefaultVariant = (products: any[]) =>
    products.map((p) => {
      const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id ASC').all(p.id) as any[];
      const first = variants[0] || {};
      const totalStock = variants.reduce((s, v) => s + Math.max(0, v.stock_quantity - v.reserved_quantity), 0);
      const effectivePrice = first.regular_price ? getEffectiveVariantPrice(first, isWholesale) : 0;
      const discountPercent =
        first.regular_price > 0 && effectivePrice < first.regular_price
          ? Math.round(((first.regular_price - effectivePrice) / first.regular_price) * 100)
          : 0;
      return {
        ...p,
        default_variant_id: first.id,
        regular_price: first.regular_price || 0,
        discount_price: first.discount_price || null,
        wholesale_price: isWholesale ? (first.wholesale_price || null) : null,
        effective_price: effectivePrice,
        discount_percent: discountPercent,
        available_stock: totalStock,
        variant_count: variants.length,
        is_wholesale_price: Boolean(isWholesale && first.wholesale_price && effectivePrice === first.wholesale_price),
      };
    });

  const bestsellers = attachDefaultVariant(
    db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.is_published = 1
      ORDER BY p.is_bestseller DESC, p.sales_count DESC
      LIMIT 8
    `).all()
  );

  const featured = attachDefaultVariant(
    db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.is_published = 1 AND p.is_featured = 1
      ORDER BY p.id DESC
      LIMIT 4
    `).all()
  );

  const blogPosts = db.prepare('SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC LIMIT 4').all();
  const sectionsRaw = getSetting('homepage_sections', '[]');
  let sections = [];
  try {
    sections = JSON.parse(sectionsRaw);
  } catch {
    sections = [];
  }

  res.json({
    categories,
    brands,
    bestsellers,
    featured,
    blog_posts: blogPosts,
    sections,
    hero: {
      kicker: getSetting('hero_kicker', 'تامین مستقیم کافه‌ها و رستری‌ها · ارسال روزانه'),
      title: getSetting('hero_title', 'ملزومات تخصصی کافی‌شاپ با کیفیت تجاری و قیمت عمده'),
      subtitle: getSetting('hero_subtitle', 'از دان قهوه اسپرسو تازه رُست و سیروپ‌های کافه‌ای تا لیوان دوجداره بیرون‌بر، فیلتر دمی و شوینده‌های استاندارد ماشین اسپرسو؛ همه یکجا با موجودی لحظه‌ای انبار.'),
      image: getSetting('hero_image', 'hero_coffee_roastery'),
      cta_label: getSetting('hero_cta_label', 'مشاهده کاتالوگ محصولات'),
    },
    settings: {
      store_name: getSetting('store_name'),
      store_phone: getSetting('store_phone'),
      store_email: getSetting('store_email'),
      store_address: getSetting('store_address'),
      free_shipping_threshold: Number(getSetting('free_shipping_threshold', '5000000')),
    },
  });
});

app.get('/api/products', (req: AuthedRequest, res) => {
  const isWholesale = isUserWholesaleApproved(req.user?.id);
  const q = String(req.query.q || '').trim();
  const categorySlug = String(req.query.category || '').trim();
  const brandSlug = String(req.query.brand || '').trim();
  const inStockOnly = req.query.inStock === '1';
  const discountedOnly = req.query.discounted === '1';
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const sort = String(req.query.sort || 'bestselling');

  let sql = `
    SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug,
           MIN(CASE
             WHEN ? = 1 AND pv.wholesale_price IS NOT NULL AND pv.wholesale_price > 0 THEN MIN(COALESCE(pv.discount_price, pv.regular_price), pv.wholesale_price)
             ELSE COALESCE(pv.discount_price, pv.regular_price)
           END) as effective_price,
           MIN(pv.regular_price) as regular_price,
           MIN(pv.discount_price) as discount_price,
           MIN(pv.wholesale_price) as wholesale_price,
           SUM(MAX(0, pv.stock_quantity - pv.reserved_quantity)) as available_stock,
           MIN(pv.id) as default_variant_id,
           COUNT(pv.id) as variant_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
    WHERE p.is_published = 1
  `;
  const params: any[] = [isWholesale ? 1 : 0];

  if (q) {
    sql += ` AND (p.title LIKE ? OR p.sku LIKE ? OR p.short_description LIKE ? OR c.name LIKE ? OR b.name LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (categorySlug) {
    sql += ` AND c.slug = ?`;
    params.push(categorySlug);
  }
  if (brandSlug) {
    sql += ` AND b.slug = ?`;
    params.push(brandSlug);
  }

  sql += ` GROUP BY p.id HAVING 1=1`;

  if (inStockOnly) {
    sql += ` AND available_stock > 0`;
  }
  if (discountedOnly) {
    sql += ` AND discount_price IS NOT NULL AND discount_price < regular_price`;
  }
  if (minPrice !== null && Number.isFinite(minPrice)) {
    sql += ` AND effective_price >= ?`;
    params.push(minPrice);
  }
  if (maxPrice !== null && Number.isFinite(maxPrice)) {
    sql += ` AND effective_price <= ?`;
    params.push(maxPrice);
  }

  switch (sort) {
    case 'newest':
      sql += ` ORDER BY p.created_at DESC`;
      break;
    case 'price_asc':
      sql += ` ORDER BY effective_price ASC`;
      break;
    case 'price_desc':
      sql += ` ORDER BY effective_price DESC`;
      break;
    default:
      sql += ` ORDER BY p.sales_count DESC, p.is_bestseller DESC`;
  }

  const rows = db.prepare(sql).all(...params) as any[];
  const products = rows.map((p) => ({
    ...p,
    wholesale_price: isWholesale ? p.wholesale_price : null,
    is_wholesale_price: Boolean(isWholesale && p.wholesale_price && p.effective_price === p.wholesale_price),
    discount_percent:
      p.regular_price > 0 && p.effective_price < p.regular_price
        ? Math.round(((p.regular_price - p.effective_price) / p.regular_price) * 100)
        : 0,
  }));

  res.json({ products, total: products.length });
});

app.get('/api/search/suggest', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.json({ products: [], categories: [] });
    return;
  }
  const like = `%${q}%`;
  const products = db.prepare(`
    SELECT p.id, p.title, p.slug, p.sku, p.main_image,
           MIN(COALESCE(pv.discount_price, pv.regular_price)) as effective_price
    FROM products p
    JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
    WHERE p.is_published = 1 AND (p.title LIKE ? OR p.sku LIKE ? OR p.short_description LIKE ?)
    GROUP BY p.id
    LIMIT 6
  `).all(like, like, like);
  const categories = db.prepare(`
    SELECT id, name, slug FROM categories WHERE is_active = 1 AND name LIKE ? LIMIT 4
  `).all(like);
  res.json({ products, categories });
});

app.get('/api/products/:slug', (req: AuthedRequest, res) => {
  const isWholesale = isUserWholesaleApproved(req.user?.id);
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug, b.country as brand_country
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.slug = ? AND p.is_published = 1
  `).get(req.params.slug) as any;

  if (!product) {
    res.status(404).json({ error: 'محصول مورد نظر یافت نشد.' });
    return;
  }

  const variants = db.prepare(`
    SELECT *, MAX(0, stock_quantity - reserved_quantity) as available_stock
    FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id ASC
  `).all(product.id) as any[];

  const reviews = db.prepare(`
    SELECT id, author_name, rating, comment, created_at
    FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC
  `).all(product.id);

  let complementaryIds: number[] = [];
  try {
    complementaryIds = JSON.parse(product.complementary_ids || '[]');
  } catch {
    complementaryIds = [];
  }
  let complementary: any[] = [];
  if (complementaryIds.length > 0) {
    const placeholders = complementaryIds.map(() => '?').join(',');
    complementary = db.prepare(`
      SELECT p.id, p.title, p.slug, p.main_image, p.unit_label_fa, p.min_order_qty, p.order_step_qty,
             MIN(pv.id) as default_variant_id, MIN(pv.regular_price) as regular_price, MIN(pv.discount_price) as discount_price,
             SUM(MAX(0, pv.stock_quantity - pv.reserved_quantity)) as available_stock
      FROM products p
      JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
      WHERE p.id IN (${placeholders}) AND p.is_published = 1
      GROUP BY p.id
    `).all(...complementaryIds);
  }

  const seo = db.prepare('SELECT * FROM seo_metadata WHERE url_path = ?').get(`/product/${product.slug}`);

  res.json({
    product: {
      ...product,
      gallery_images: JSON.parse(product.gallery_images || '[]'),
      specifications: JSON.parse(product.specifications || '{}'),
    },
    variants: variants.map((v) => ({
      ...v,
      attributes: JSON.parse(v.attributes || '{}'),
      wholesale_price: isWholesale ? v.wholesale_price : null,
      effective_price: getEffectiveVariantPrice(v, isWholesale),
      is_wholesale_price: Boolean(isWholesale && v.wholesale_price && getEffectiveVariantPrice(v, true) === v.wholesale_price),
    })),
    reviews,
    complementary,
    seo,
    is_wholesale_applied: isWholesale,
  });
});

app.post('/api/products/:slug/reviews', (req: AuthedRequest, res) => {
  const { author_name, rating, comment } = req.body || {};
  const product = db.prepare('SELECT id FROM products WHERE slug = ? AND is_published = 1').get(req.params.slug) as any;
  if (!product) {
    res.status(404).json({ error: 'محصول یافت نشد.' });
    return;
  }
  const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
  if (!comment?.trim() || (!req.user && !author_name?.trim())) {
    res.status(400).json({ error: 'لطفاً نام و متن نظر خود را وارد کنید.' });
    return;
  }
  const finalAuthor = req.user ? req.user.name : author_name.trim();
  const r = db.prepare(`
    INSERT INTO reviews (product_id, user_id, author_name, rating, comment, is_approved)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(product.id, req.user?.id || null, finalAuthor, numericRating, comment.trim());
  const review = db.prepare('SELECT id, author_name, rating, comment, created_at FROM reviews WHERE id = ?').get(r.lastInsertRowid);
  res.json({ review });
});

app.get('/api/blog', (_req, res) => {
  const posts = db.prepare('SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC').all();
  res.json({ posts });
});

app.get('/api/blog/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1').get(req.params.slug);
  if (!post) {
    res.status(404).json({ error: 'مقاله یافت نشد.' });
    return;
  }
  res.json({ post });
});

app.get('/api/faqs', (_req, res) => {
  const faqs = db.prepare('SELECT * FROM faqs ORDER BY display_order ASC').all();
  res.json({ faqs });
});

app.get('/api/settings/public', (_req, res) => {
  res.json({
    store_name: getSetting('store_name'),
    store_phone: getSetting('store_phone'),
    store_email: getSetting('store_email'),
    store_address: getSetting('store_address'),
    free_shipping_threshold: Number(getSetting('free_shipping_threshold', '5000000')),
    bank_name: getSetting('bank_name'),
    bank_account_holder: getSetting('bank_account_holder'),
    bank_card_number: getSetting('bank_card_number'),
    bank_iban: getSetting('bank_iban'),
    bank_instructions: getSetting('bank_instructions'),
  });
});

// ========================
// DIGIKALA-INSPIRED SHOPPING CART ROUTES
// ========================
app.get('/api/cart', (req: AuthedRequest, res) => {
  const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
  const shippingMethodId = req.query.shippingMethodId ? Number(req.query.shippingMethodId) : null;
  res.json(getCartSummary(cart.id, shippingMethodId));
});

app.post('/api/cart/items', (req: AuthedRequest, res) => {
  const { product_id, variant_id, quantity, mode } = req.body || {};
  const variant = db.prepare(`
    SELECT pv.*, p.is_published, p.min_order_qty, p.order_step_qty, p.max_order_qty
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = ? AND pv.product_id = ? AND pv.is_active = 1
  `).get(Number(variant_id), Number(product_id)) as any;

  if (!variant || variant.is_published !== 1) {
    res.status(404).json({ error: 'محصول یا تنوع انتخاب‌شده در دسترس نیست.' });
    return;
  }

  const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
  const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND variant_id = ?').get(cart.id, variant.id) as any;

  const available = Math.max(0, variant.stock_quantity - variant.reserved_quantity);
  const requestedBase = Number(quantity) || variant.min_order_qty;
  const targetQty = mode === 'set' ? requestedBase : (existing ? existing.quantity + requestedBase : requestedBase);

  const check = validateAndNormalizeQuantity(targetQty, variant.min_order_qty, variant.order_step_qty, variant.max_order_qty, available);
  if (!check.ok) {
    res.status(400).json({ error: check.error });
    return;
  }

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(check.quantity, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)').run(
      cart.id, variant.product_id, variant.id, check.quantity
    );
  }

  res.json(getCartSummary(cart.id));
});

app.patch('/api/cart/items/:itemId', (req: AuthedRequest, res) => {
  const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
  const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?').get(Number(req.params.itemId), cart.id) as any;
  if (!item) {
    res.status(404).json({ error: 'آیتم در سبد خرید یافت نشد.' });
    return;
  }

  const qty = Number(req.body?.quantity);
  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
    res.json(getCartSummary(cart.id));
    return;
  }

  const variant = db.prepare(`
    SELECT pv.*, p.min_order_qty, p.order_step_qty, p.max_order_qty
    FROM product_variants pv JOIN products p ON p.id = pv.product_id
    WHERE pv.id = ?
  `).get(item.variant_id) as any;
  const available = Math.max(0, variant.stock_quantity - variant.reserved_quantity);
  const check = validateAndNormalizeQuantity(qty, variant.min_order_qty, variant.order_step_qty, variant.max_order_qty, available);
  if (!check.ok) {
    res.status(400).json({ error: check.error });
    return;
  }

  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(check.quantity, item.id);
  res.json(getCartSummary(cart.id));
});

app.delete('/api/cart/items/:itemId', (req: AuthedRequest, res) => {
  const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
  db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(Number(req.params.itemId), cart.id);
  res.json(getCartSummary(cart.id));
});

app.delete('/api/cart', (req: AuthedRequest, res) => {
  const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  db.prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?').run(cart.id);
  res.json(getCartSummary(cart.id));
});

app.post('/api/cart/coupon', (req: AuthedRequest, res) => {
  const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) {
    db.prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?').run(cart.id);
    res.json(getCartSummary(cart.id));
    return;
  }
  db.prepare('UPDATE carts SET coupon_code = ? WHERE id = ?').run(code, cart.id);
  const summary = getCartSummary(cart.id);
  if (summary.coupon_error) {
    db.prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?').run(cart.id);
    res.status(400).json({ error: summary.coupon_error });
    return;
  }
  res.json(summary);
});

app.get('/api/shipping-methods', (_req, res) => {
  const methods = db.prepare('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY id ASC').all();
  res.json({ methods });
});

// ========================
// CHECKOUT & PAYMENTS
// ========================
app.post('/api/checkout', (req: AuthedRequest, res) => {
  try {
    const {
      customer_name,
      customer_mobile,
      customer_email,
      shipping_address,
      shipping_method_id,
      payment_method,
    } = req.body || {};

    if (!customer_name?.trim() || !customer_mobile?.trim()) {
      res.status(400).json({ error: 'نام و شماره موبایل خریدار الزامی است.' });
      return;
    }
    if (!shipping_address?.province?.trim() || !shipping_address?.city?.trim() || !shipping_address?.full_address?.trim()) {
      res.status(400).json({ error: 'لطفاً استان، شهر و نشانی کامل تحویل را وارد کنید.' });
      return;
    }
    if (payment_method !== 'online_gateway' && payment_method !== 'bank_transfer') {
      res.status(400).json({ error: 'روش پرداخت نامعتبر است.' });
      return;
    }

    const cart = getOrCreateCart(req.user?.id || null, req.guestToken || null);
    const created = createOrderFromCart({
      cartId: cart.id,
      userId: req.user?.id || null,
      guestToken: req.guestToken || null,
      customerName: customer_name.trim(),
      customerMobile: customer_mobile.trim(),
      customerEmail: customer_email?.trim(),
      shippingAddress: {
        receiver_name: shipping_address.receiver_name?.trim() || customer_name.trim(),
        receiver_mobile: shipping_address.receiver_mobile?.trim() || customer_mobile.trim(),
        province: shipping_address.province.trim(),
        city: shipping_address.city.trim(),
        postal_code: shipping_address.postal_code?.trim() || '',
        full_address: shipping_address.full_address.trim(),
      },
      shippingMethodId: Number(shipping_method_id),
      paymentMethod: payment_method,
    });

    res.json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'خطا در ثبت نهایی سفارش.' });
  }
});

app.get('/api/payment/info/:orderNumber', (req: AuthedRequest, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber) as any;
  if (!order) {
    res.status(404).json({ error: 'سفارش یافت نشد.' });
    return;
  }
  const isOwner =
    (req.user && order.user_id === req.user.id) ||
    (req.guestToken && order.guest_token === req.guestToken) ||
    (req.user && (req.user.role === 'admin' || req.user.role === 'manager'));
  if (!isOwner) {
    res.status(403).json({ error: 'دسترسی به اطلاعات این سفارش مجاز نیست.' });
    return;
  }
  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const history = db.prepare('SELECT * FROM order_status_histories WHERE order_id = ? ORDER BY id ASC').all(order.id);
  res.json({
    order: { ...order, shipping_address_snapshot: JSON.parse(order.shipping_address_snapshot || '{}') },
    payment,
    items,
    history,
  });
});

app.post('/api/payment/gateway/verify', (req, res) => {
  try {
    const { authority_token, success, reference_id } = req.body || {};
    if (!authority_token) {
      res.status(400).json({ error: 'توکن تراکنش ارسال نشده است.' });
      return;
    }
    const result = verifyOnlineGatewayPayment(String(authority_token), Boolean(success), reference_id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payment/bank-transfer/submit', uploadReceipt.single('receipt'), (req: AuthedRequest, res) => {
  try {
    const { order_number, reference_id, card_last4 } = req.body || {};
    if (!order_number || !reference_id?.trim()) {
      res.status(400).json({ error: 'شماره سفارش و کد پیگیری بانکی الزامی است.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'لطفاً تصویر فیش واریزی را انتخاب کنید.' });
      return;
    }
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_number) as any;
    if (!order) {
      res.status(404).json({ error: 'سفارش یافت نشد.' });
      return;
    }
    const isOwner = (req.user && order.user_id === req.user.id) || (req.guestToken && order.guest_token === req.guestToken);
    if (!isOwner) {
      res.status(403).json({ error: 'شما مجاز به ثبت فیش برای این سفارش نیستید.' });
      return;
    }
    const payment = db.prepare("SELECT * FROM payments WHERE order_id = ? AND method = 'bank_transfer' ORDER BY id DESC LIMIT 1").get(order.id) as any;
    if (!payment || payment.status !== 'pending') {
      res.status(400).json({ error: 'امکان ارسال مجدد فیش برای این سفارش وجود ندارد.' });
      return;
    }

    withTransaction(() => {
      db.prepare(`
        UPDATE payments SET reference_id = ?, card_last4 = ?, receipt_filename = ? WHERE id = ?
      `).run(reference_id.trim(), String(card_last4 || '').slice(0, 4), req.file!.filename, payment.id);

      db.prepare("UPDATE orders SET status = 'payment_verification' WHERE id = ?").run(order.id);
      db.prepare(`
        INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
        VALUES (?, ?, 'payment_verification', ?)
      `).run(order.id, order.status, `فیش کارت‌به‌کارت با کد پیگیری ${reference_id.trim()} ارسال شد.`, req.user?.id || null);
    });

    res.json({ ok: true, status: 'payment_verification', receipt_filename: req.file.filename });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'خطا در ثبت فیش واریزی.' });
  }
});

// Protected Private Receipt Image Endpoint
app.get('/api/receipts/:filename', (req: AuthedRequest, res) => {
  const filename = path.basename(req.params.filename);
  const payment = db.prepare(`
    SELECT p.*, o.user_id, o.guest_token
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.receipt_filename = ?
  `).get(filename) as any;

  if (!payment) {
    res.status(404).json({ error: 'فیش یافت نشد.' });
    return;
  }
  const isAuthorized =
    (req.user && (req.user.role === 'admin' || req.user.role === 'manager' || req.user.id === payment.user_id)) ||
    (req.guestToken && req.guestToken === payment.guest_token);

  if (!isAuthorized) {
    res.status(403).json({ error: 'دسترسی به فیش بانکی فقط برای مالک سفارش و مدیر مجاز است.' });
    return;
  }

  const filePath = path.join(UPLOAD_RECEIPTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'فایل در سرور موجود نیست.' });
    return;
  }
  res.sendFile(filePath);
});

// ========================
// CUSTOMER PANEL ROUTES
// ========================
app.get('/api/customer/addresses', requireAuth, (req: AuthedRequest, res) => {
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id);
  res.json({ addresses });
});

app.post('/api/customer/addresses', requireAuth, (req: AuthedRequest, res) => {
  const { title, receiver_name, receiver_mobile, province, city, postal_code, full_address, is_default } = req.body || {};
  if (!title || !receiver_name || !receiver_mobile || !province || !city || !full_address) {
    res.status(400).json({ error: 'تمام فیلدهای آدرس الزامی هستند.' });
    return;
  }
  if (is_default) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  }
  const r = db.prepare(`
    INSERT INTO addresses (user_id, title, receiver_name, receiver_mobile, province, city, postal_code, full_address, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, receiver_name, receiver_mobile, province, city, postal_code || '', full_address, is_default ? 1 : 0);
  res.json({ address: db.prepare('SELECT * FROM addresses WHERE id = ?').get(r.lastInsertRowid) });
});

app.delete('/api/customer/addresses/:id', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

app.get('/api/customer/orders', requireAuth, (req: AuthedRequest, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id) as any[];
  const enriched = orders.map((o) => ({
    ...o,
    shipping_address_snapshot: JSON.parse(o.shipping_address_snapshot || '{}'),
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    payment: db.prepare('SELECT method, status, reference_id, receipt_filename, rejection_reason FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(o.id),
    history: db.prepare('SELECT * FROM order_status_histories WHERE order_id = ? ORDER BY id ASC').all(o.id),
  }));
  res.json({ orders: enriched });
});

app.get('/api/customer/wishlist', requireAuth, (req: AuthedRequest, res) => {
  const items = db.prepare(`
    SELECT p.id, p.title, p.slug, p.main_image, p.unit_label_fa,
           MIN(pv.id) as default_variant_id, MIN(pv.regular_price) as regular_price, MIN(pv.discount_price) as discount_price
    FROM wishlists w
    JOIN products p ON p.id = w.product_id
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE w.user_id = ?
    GROUP BY p.id
  `).all(req.user.id);
  res.json({ items });
});

app.post('/api/customer/wishlist/toggle', requireAuth, (req: AuthedRequest, res) => {
  const productId = Number(req.body?.product_id);
  const exists = db.prepare('SELECT 1 FROM wishlists WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (exists) {
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
    res.json({ wishlisted: false });
  } else {
    db.prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)').run(req.user.id, productId);
    res.json({ wishlisted: true });
  }
});

app.get('/api/customer/notifications', requireAuth, (req: AuthedRequest, res) => {
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
  res.json({ notifications });
});

app.post('/api/customer/wholesale-apply', requireAuth, (req: AuthedRequest, res) => {
  const { cafe_name, business_id } = req.body || {};
  if (!cafe_name?.trim()) {
    res.status(400).json({ error: 'نام کافی‌شاپ یا مجموعه تجاری الزامی است.' });
    return;
  }
  db.prepare(`
    UPDATE users SET cafe_name = ?, business_id = ?, wholesale_status = 'pending' WHERE id = ?
  `).run(cafe_name.trim(), business_id?.trim() || null, req.user.id);
  logActivity(req.user.id, 'wholesale_application', 'user', req.user.id, `ثبت درخواست همکاری عمده توسط ${cafe_name.trim()}`);
  res.json({ ok: true, wholesale_status: 'pending' });
});

// ========================
// SEO PUBLIC API, SITEMAPS & ROBOTS.TXT
// ========================
app.get('/api/seo/resolve', (req, res) => {
  const urlPath = String(req.query.path || '/');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const seo = db.prepare('SELECT * FROM seo_metadata WHERE url_path = ?').get(urlPath) as any;
  const schemas = buildJsonLdForUrl(urlPath, baseUrl);
  res.json({ seo: seo || null, schemas });
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(generateSitemapIndexXml(baseUrl));
});

app.get('/sitemap-:type.xml', (req, res) => {
  const t = req.params.type as any;
  if (!['pages', 'categories', 'products', 'blog'].includes(t)) {
    res.status(404).send('Not found');
    return;
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(generateSubSitemapXml(t, baseUrl));
});

app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(getSetting('robots_txt', 'User-agent: *\nAllow: /'));
});

// ========================
// ADMIN PANEL ROUTES (ENTERPRISE + RBAC)
// ========================
registerEnterpriseAdminRoutes(app, requireAdmin, requirePermission);

app.patch('/api/admin/variants/:id/stock', requireAdmin, requirePermission('inventory.adjust'), (req: AuthedRequest, res) => {
  const variantId = Number(req.params.id);
  const { stock_quantity, regular_price, discount_price, wholesale_price, note } = req.body || {};
  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId) as any;
  if (!variant) {
    res.status(404).json({ error: 'تنوع کالا یافت نشد.' });
    return;
  }
  const newStock = Math.max(0, Number(stock_quantity ?? variant.stock_quantity));
  const delta = newStock - variant.stock_quantity;

  withTransaction(() => {
    db.prepare(`
      UPDATE product_variants SET stock_quantity = ?, regular_price = ?, discount_price = ?, wholesale_price = ? WHERE id = ?
    `).run(
      newStock,
      Number(regular_price ?? variant.regular_price),
      discount_price !== undefined && discount_price !== null && discount_price !== '' ? Number(discount_price) : null,
      wholesale_price !== undefined ? (wholesale_price !== null && wholesale_price !== '' ? Number(wholesale_price) : null) : variant.wholesale_price,
      variantId
    );
    if (delta !== 0) {
      db.prepare(`
        INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, note, created_by)
        VALUES (?, 'adjustment', ?, ?, ?, 'admin_stock_update', ?, ?)
      `).run(variantId, delta, variant.stock_quantity, newStock, note || 'تنظیم دستی موجودی توسط ادمین', req.user.id);
    }
    logActivity(req.user.id, 'adjust_stock', 'product_variant', variantId, `تغییر موجودی SKU ${variant.sku} به ${newStock}`);
  });
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, requirePermission('orders.view'), (_req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as any[];
  const enriched = orders.map((o) => ({
    ...o,
    shipping_address_snapshot: JSON.parse(o.shipping_address_snapshot || '{}'),
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    payment: db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(o.id),
    history: db.prepare('SELECT * FROM order_status_histories WHERE order_id = ? ORDER BY id ASC').all(o.id),
  }));
  res.json({ orders: enriched });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, requirePermission('orders.update'), (req: AuthedRequest, res) => {
  const orderId = Number(req.params.id);
  const { status, tracking_code, admin_notes, customer_note, note } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ error: 'سفارش یافت نشد.' });
    return;
  }
  withTransaction(() => {
    db.prepare('UPDATE orders SET status = ?, tracking_code = ?, admin_notes = ?, customer_note = ? WHERE id = ?').run(
      status || order.status,
      tracking_code !== undefined ? tracking_code : order.tracking_code,
      admin_notes !== undefined ? admin_notes : order.admin_notes,
      customer_note !== undefined ? customer_note : order.customer_note,
      orderId
    );
    if (status && status !== order.status) {
      db.prepare(`
        INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, order.status, status, note || `تغییر وضعیت به ${status}`, req.user.id);
    }
    logActivity(req.user.id, 'update_order_status', 'order', orderId, `بروزرسانی سفارش ${order.order_number} (${status || order.status})`);
  });
  res.json({ ok: true });
});

app.post('/api/admin/payments/:id/review', requireAdmin, requirePermission('payments.verify'), (req: AuthedRequest, res) => {
  try {
    const { approve, rejection_reason } = req.body || {};
    const result = reviewBankTransferReceipt(Number(req.params.id), req.user.id, Boolean(approve), rejection_reason);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/customers', requireAdmin, requirePermission('customers.view'), (_req, res) => {
  const customers = db.prepare(`
    SELECT u.id, u.name, u.mobile, u.email, u.role, u.status, u.cafe_name,
           u.customer_group, u.wholesale_status, u.business_id, u.credit_limit, u.payment_terms, u.internal_notes, u.created_at,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as orders_count,
           (SELECT COALESCE(SUM(o.total_payable), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') as total_spent
    FROM users u ORDER BY u.id DESC
  `).all();
  res.json({ customers });
});

app.patch('/api/admin/customers/:id/status', requireAdmin, requirePermission('customers.update'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status === 'blocked' ? 'blocked' : 'active';
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  logActivity(req.user.id, 'update_customer_status', 'user', id, `تغییر وضعیت حساب کاربر به ${status}`);
  res.json({ ok: true });
});

app.get('/api/admin/coupons', requireAdmin, requirePermission('coupons.manage'), (_req, res) => {
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() });
});

app.post('/api/admin/coupons', requireAdmin, requirePermission('coupons.manage'), (req: AuthedRequest, res) => {
  const { code, title, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, customer_group, first_order_only, expires_at } = req.body || {};
  if (!code?.trim() || !title?.trim() || !discount_value) {
    res.status(400).json({ error: 'کد، عنوان و مقدار تخفیف الزامی است.' });
    return;
  }
  const r = db.prepare(`
    INSERT INTO coupons (code, title, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, customer_group, first_order_only, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code.trim().toUpperCase(),
    title.trim(),
    discount_type === 'fixed' ? 'fixed' : 'percent',
    Number(discount_value),
    Number(min_order_amount) || 0,
    max_discount_amount ? Number(max_discount_amount) : null,
    usage_limit ? Number(usage_limit) : null,
    customer_group?.trim() || null,
    first_order_only ? 1 : 0,
    expires_at?.trim() || null
  );
  logActivity(req.user.id, 'create_coupon', 'coupon', Number(r.lastInsertRowid), `ایجاد کد تخفیف ${code.toUpperCase()}`);
  res.json({ ok: true });
});

app.delete('/api/admin/coupons/:id', requireAdmin, requirePermission('coupons.manage'), (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
  logActivity(req.user.id, 'delete_coupon', 'coupon', Number(req.params.id), `حذف کد تخفیف #${req.params.id}`);
  res.json({ ok: true });
});

// Admin SEO Dashboard Routes
app.get('/api/admin/seo', requireAdmin, requirePermission('seo.view'), (_req, res) => {
  const pages = db.prepare('SELECT * FROM seo_metadata ORDER BY entity_type ASC, id ASC').all() as any[];
  const redirects = db.prepare('SELECT * FROM seo_redirects ORDER BY id DESC').all();
  res.json({
    pages: pages.map((p) => ({ ...p, analysis: JSON.parse(p.analysis_json || '{}') })),
    redirects,
    robots_txt: getSetting('robots_txt'),
  });
});

app.post('/api/admin/seo/analyze', requireAdmin, requirePermission('seo.view'), (req, res) => {
  const result = analyzeSeoContent(req.body || {});
  res.json(result);
});

app.put('/api/admin/seo/:id', requireAdmin, requirePermission('seo.update'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM seo_metadata WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'رکورد سئو یافت نشد.' });
    return;
  }
  const {
    seo_title, meta_description, focus_keyword, secondary_keywords,
    canonical_url, robots_index, robots_follow, og_title, og_description,
    schema_type, custom_json_ld,
  } = req.body || {};

  if (custom_json_ld && custom_json_ld.trim()) {
    try {
      JSON.parse(custom_json_ld);
    } catch {
      res.status(400).json({ error: 'فرمت JSON-LD سفارشی معتبر نیست.' });
      return;
    }
  }

  const audit = analyzeSeoContent({
    url_path: existing.url_path,
    seo_title: seo_title ?? existing.seo_title,
    meta_description: meta_description ?? existing.meta_description,
    focus_keyword: focus_keyword ?? existing.focus_keyword,
    content_text: `${seo_title} ${meta_description} ${secondary_keywords || ''}`,
    robots_index: robots_index !== undefined ? Boolean(robots_index) : Boolean(existing.robots_index),
    schema_type: schema_type ?? existing.schema_type,
    custom_json_ld: custom_json_ld ?? existing.custom_json_ld,
  });

  db.prepare(`
    UPDATE seo_metadata
    SET seo_title = ?, meta_description = ?, focus_keyword = ?, secondary_keywords = ?,
        canonical_url = ?, robots_index = ?, robots_follow = ?, og_title = ?, og_description = ?,
        schema_type = ?, custom_json_ld = ?, seo_score = ?, analysis_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    seo_title ?? existing.seo_title,
    meta_description ?? existing.meta_description,
    focus_keyword ?? existing.focus_keyword,
    secondary_keywords ?? existing.secondary_keywords,
    canonical_url ?? existing.canonical_url,
    robots_index !== undefined ? (robots_index ? 1 : 0) : existing.robots_index,
    robots_follow !== undefined ? (robots_follow ? 1 : 0) : existing.robots_follow,
    og_title ?? seo_title ?? existing.og_title,
    og_description ?? meta_description ?? existing.og_description,
    schema_type ?? existing.schema_type,
    custom_json_ld ?? existing.custom_json_ld,
    audit.score,
    JSON.stringify(audit),
    id
  );

  logActivity(req.user.id, 'update_seo', 'seo_metadata', id, `بروزرسانی سئو صفحه ${existing.url_path} (امتیاز: ${audit.score})`);
  res.json({ ok: true, audit });
});

app.post('/api/admin/redirects', requireAdmin, requirePermission('seo.update'), (req: AuthedRequest, res) => {
  const { source_path, target_path, status_code } = req.body || {};
  if (!source_path?.startsWith('/') || !target_path?.startsWith('/')) {
    res.status(400).json({ error: 'مسیر مبدا و مقصد باید با / شروع شوند.' });
    return;
  }
  const code = Number(status_code) === 302 ? 302 : 301;
  db.prepare('INSERT OR REPLACE INTO seo_redirects (source_path, target_path, status_code, is_active) VALUES (?, ?, ?, 1)').run(
    source_path.trim(), target_path.trim(), code
  );
  logActivity(req.user.id, 'create_redirect', 'seo_redirect', null, `ریدایرکت ${code}: ${source_path} -> ${target_path}`);
  res.json({ ok: true });
});

app.delete('/api/admin/redirects/:id', requireAdmin, requirePermission('seo.update'), (req, res) => {
  db.prepare('DELETE FROM seo_redirects WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, requirePermission('settings.update'), (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});

app.put('/api/admin/settings', requireAdmin, requirePermission('settings.update'), (req: AuthedRequest, res) => {
  const payload = req.body?.settings || {};
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  withTransaction(() => {
    for (const [k, v] of Object.entries(payload)) {
      upsert.run(k, String(v ?? ''));
    }
    logActivity(req.user.id, 'update_settings', 'settings', null, 'بروزرسانی تنظیمات فروشگاه و اطلاعات بانکی');
  });
  res.json({ ok: true });
});

// ========================
// VITE / HTML SSR SEO INJECTION
// ========================
function injectSeoTags(html: string, urlPath: string, baseUrl: string): string {
  const seo = db.prepare('SELECT * FROM seo_metadata WHERE url_path = ?').get(urlPath) as any;
  const isPrivate = ['/cart', '/checkout', '/panel', '/admin'].some((p) => urlPath.startsWith(p));

  const title = seo?.seo_title || 'BaristaPro - سامانه تخصصی ملزومات کافی‌شاپ';
  const desc = seo?.meta_description || 'فروشگاه تخصصی تامین ملزومات کافی‌شاپ، دان قهوه، سیروپ و تجهیزات باریستا';
  const robots = isPrivate
    ? 'noindex, nofollow'
    : `${seo?.robots_index === 0 ? 'noindex' : 'index'}, ${seo?.robots_follow === 0 ? 'nofollow' : 'follow'}`;
  const canonical = `${baseUrl}${seo?.canonical_url || urlPath}`;
  const schemas = isPrivate ? [] : buildJsonLdForUrl(urlPath, baseUrl);
  const schemaScript = schemas.length
    ? `<script type="application/ld+json">${JSON.stringify(schemas)}</script>`
    : '';

  return html
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${desc.replace(/"/g, '&quot;')}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${(seo?.og_title || title).replace(/"/g, '&quot;')}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${(seo?.og_description || desc).replace(/"/g, '&quot;')}" />`)
    .replace('</head>', `  <meta name="robots" content="${robots}" />\n  <link rel="canonical" href="${canonical}" />\n  ${schemaScript}\n</head>`);
}

// JSON 404 & Error Handlers for /api/*
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'مسیر API درخواست‌شده یافت نشد.' });
});

app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err);
  res.status(err?.status || 500).json({ error: err?.message || 'خطای داخلی سرور' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        next();
        return;
      }
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urlPath = req.originalUrl.split('?')[0] || '/';
        const finalHtml = injectSeoTags(template, urlPath, baseUrl);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const urlPath = req.originalUrl.split('?')[0] || '/';
      res.status(200).set({ 'Content-Type': 'text/html' }).end(injectSeoTags(indexHtml, urlPath, baseUrl));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BaristaPro E-Commerce Server running on http://localhost:${PORT}`);
  });
}

startServer();
