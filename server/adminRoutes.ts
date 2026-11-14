import type { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db, withTransaction, UPLOAD_MEDIA_DIR } from './db.ts';
import { hashPassword, ALL_PERMISSIONS } from './seed.ts';
import { analyzeSeoContent } from './seoEngine.ts';
import {
  cancelOrderWithStockRestore,
  createNotification,
  getSetting,
  logActivity,
  recordOrderRefund,
  reviewBankTransferReceipt,
} from './services.ts';

export interface AuthedRequest extends Request {
  user?: any;
  guestToken?: string;
}

const BUILTIN_MEDIA_METADATA = [
  { key: 'hero_coffee_roastery', title: 'بنر اصلی کافه و تجهیزات باریستا', folder: 'banners' },
  { key: 'prod_arabica_beans', title: 'دان قهوه اسپرسو عربیکا', folder: 'products' },
  { key: 'prod_paper_cups', title: 'لیوان کاغذی دوجداره کرافت', folder: 'products' },
  { key: 'prod_coffee_syrup', title: 'سیروپ تخصصی کارامل و وانیل', folder: 'products' },
  { key: 'prod_barista_tools', title: 'ست تمپر استیل و پیچر باریستا', folder: 'products' },
  { key: 'prod_machine_cleaner', title: 'پودر شستشو و جرم‌گیر اسپرسوساز', folder: 'products' },
  { key: 'prod_cocoa_powder', title: 'پودر کاکائو هلندی دارک', folder: 'products' },
  { key: 'prod_v60_filters', title: 'فیلتر کاغذی قهوه دمی V60', folder: 'products' },
];

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_MEDIA_DIR),
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(rawExt) ? rawExt : '.jpg';
    cb(null, `media-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  },
});

const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل مجاز نیست. فقط JPG، PNG، WEBP یا SVG مجاز است.'));
    }
  },
});

function sanitizeSvgFileIfNeeded(filePath: string, mimeType: string) {
  if (mimeType !== 'image/svg+xml') return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleaned = content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
  fs.writeFileSync(filePath, cleaned, 'utf-8');
}

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return '\uFEFF' + lines.join('\n');
}

function getDateCondition(range: string, column = 'created_at'): string {
  switch (range) {
    case 'today':
      return `date(${column}) = date('now')`;
    case 'yesterday':
      return `date(${column}) = date('now', '-1 day')`;
    case '7d':
      return `datetime(${column}) >= datetime('now', '-7 days')`;
    case '30d':
      return `datetime(${column}) >= datetime('now', '-30 days')`;
    default:
      return '1=1';
  }
}

export function getUserPermissions(user: any): string[] {
  if (!user) return [];
  if (user.role === 'admin' || user.admin_role_key === 'super_admin') {
    return ['*'];
  }
  if (user.role !== 'manager') return [];
  const roleKey = user.admin_role_key || 'store_manager';
  const rows = db.prepare('SELECT permission_key FROM role_permissions WHERE role_key = ?').all(roleKey) as Array<{ permission_key: string }>;
  return rows.map((r) => r.permission_key);
}

export function registerEnterpriseAdminRoutes(
  app: Express,
  requireAdmin: (req: AuthedRequest, res: Response, next: NextFunction) => void,
  requirePermission: (perm: string) => (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  // ========================
  // 1. DASHBOARD ANALYTICS
  // ========================
  app.get('/api/admin/dashboard', requireAdmin, requirePermission('dashboard.view'), (req, res) => {
    const range = String(req.query.range || 'all');
    const dateCond = getDateCondition(range, 'created_at');
    const paidStatuses = "('paid','processing','preparing','shipped','delivered')";

    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(total_payable), 0) as total, COUNT(*) as count
      FROM orders
      WHERE status IN ${paidStatuses} AND ${dateCond}
    `).get() as any;

    const todayRow = db.prepare(`
      SELECT COALESCE(SUM(total_payable), 0) as revenue, COUNT(*) as count
      FROM orders
      WHERE status IN ${paidStatuses} AND date(created_at) = date('now')
    `).get() as any;

    const monthlyRow = db.prepare(`
      SELECT COALESCE(SUM(total_payable), 0) as revenue
      FROM orders
      WHERE status IN ${paidStatuses} AND datetime(created_at) >= datetime('now', '-30 days')
    `).get() as any;

    const totalOrders = (db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE ${dateCond}`).get() as any).cnt;
    const pendingOrders = (db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('pending_payment','payment_verification')").get() as any).cnt;
    const completedOrders = (db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE status IN ('delivered','shipped') AND ${dateCond}`).get() as any).cnt;
    const cancelledOrders = (db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE status IN ('cancelled','refunded') AND ${dateCond}`).get() as any).cnt;
    const pendingReceipts = (db.prepare("SELECT COUNT(*) as cnt FROM payments WHERE method = 'bank_transfer' AND status = 'pending' AND receipt_filename IS NOT NULL").get() as any).cnt;

    const totalCustomers = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'customer'").get() as any).cnt;
    const newCustomers = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'customer' AND datetime(created_at) >= datetime('now', '-30 days')").get() as any).cnt;
    const wholesalePending = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE wholesale_status = 'pending'").get() as any).cnt;

    const totalProducts = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as any).cnt;
    const activeProducts = (db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_published = 1').get() as any).cnt;
    const outOfStockCount = (db.prepare('SELECT COUNT(*) as cnt FROM product_variants WHERE is_active = 1 AND (stock_quantity - reserved_quantity) <= 0').get() as any).cnt;
    const lowStockCount = (db.prepare('SELECT COUNT(*) as cnt FROM product_variants WHERE is_active = 1 AND (stock_quantity - reserved_quantity) > 0 AND (stock_quantity - reserved_quantity) <= COALESCE(min_stock_alert, 10)').get() as any).cnt;
    const invValueRow = db.prepare(`
      SELECT COALESCE(SUM(MAX(0, stock_quantity - reserved_quantity) * COALESCE(cost_price, regular_price)), 0) as total_val,
             COALESCE(SUM(MAX(0, stock_quantity - reserved_quantity)), 0) as total_units
      FROM product_variants WHERE is_active = 1
    `).get() as any;

    const missingImageCount = (db.prepare("SELECT COUNT(*) as cnt FROM products WHERE main_image IS NULL OR trim(main_image) = ''").get() as any).cnt;
    const missingSeoCount = (db.prepare("SELECT COUNT(*) as cnt FROM seo_metadata WHERE seo_score < 60 OR trim(meta_description) = ''").get() as any).cnt;
    const unreadNotifications = (db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0 AND (user_id IS NULL OR user_id = ?)').get((req as AuthedRequest).user?.id || 0) as any).cnt;

    const lowStockVariants = db.prepare(`
      SELECT pv.*, p.title as product_title, p.slug as product_slug
      FROM product_variants pv JOIN products p ON p.id = pv.product_id
      WHERE pv.is_active = 1 AND (pv.stock_quantity - pv.reserved_quantity) <= COALESCE(pv.min_stock_alert, 10)
      ORDER BY (pv.stock_quantity - pv.reserved_quantity) ASC
      LIMIT 10
    `).all();

    const recentOrders = db.prepare('SELECT id, order_number, customer_name, total_payable, status, payment_method, created_at FROM orders ORDER BY created_at DESC LIMIT 8').all();
    const recentLogs = db.prepare(`
      SELECT a.*, u.name as user_name
      FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 12
    `).all();

    const dailyChart = db.prepare(`
      SELECT date(created_at) as day, COALESCE(SUM(total_payable), 0) as revenue, COUNT(*) as orders
      FROM orders
      WHERE status != 'cancelled' AND ${dateCond}
      GROUP BY date(created_at)
      ORDER BY day DESC LIMIT 14
    `).all();

    const orderStatusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total_payable), 0) as total
      FROM orders WHERE ${dateCond}
      GROUP BY status
    `).all();

    const paymentMethodBreakdown = db.prepare(`
      SELECT payment_method as method, COUNT(*) as count, COALESCE(SUM(total_payable), 0) as total
      FROM orders WHERE status != 'cancelled' AND ${dateCond}
      GROUP BY payment_method
    `).all();

    const topProducts = db.prepare(`
      SELECT p.id, p.title, p.sku, p.main_image, p.sales_count,
             COALESCE(SUM(oi.line_total), 0) as order_revenue,
             COALESCE(SUM(oi.quantity), 0) as units_sold
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      GROUP BY p.id
      ORDER BY p.sales_count DESC, order_revenue DESC
      LIMIT 6
    `).all();

    const topCategories = db.prepare(`
      SELECT c.id, c.name, COUNT(p.id) as product_count, COALESCE(SUM(p.sales_count), 0) as total_sales
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY total_sales DESC
    `).all();

    res.json({
      stats: {
        total_revenue: revenueRow.total,
        today_revenue: todayRow.revenue,
        monthly_revenue: monthlyRow.revenue,
        paid_orders: revenueRow.count,
        total_orders: totalOrders,
        today_orders: todayRow.count,
        pending_orders: pendingOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        pending_receipts: pendingReceipts,
        total_customers: totalCustomers,
        new_customers: newCustomers,
        wholesale_pending: wholesalePending,
        total_products: totalProducts,
        active_products: activeProducts,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        total_inventory_value: invValueRow.total_val,
        total_inventory_units: invValueRow.total_units,
        missing_image_count: missingImageCount,
        missing_seo_count: missingSeoCount,
        unread_notifications: unreadNotifications,
      },
      low_stock_variants: lowStockVariants,
      recent_orders: recentOrders,
      recent_logs: recentLogs,
      daily_chart: dailyChart.reverse(),
      order_status_breakdown: orderStatusBreakdown,
      payment_method_breakdown: paymentMethodBreakdown,
      top_products: topProducts,
      top_categories: topCategories,
    });
  });

  // ========================
  // 2. MEDIA LIBRARY & FILE UPLOAD
  // ========================
  app.get('/api/admin/media', requireAdmin, requirePermission('media.manage'), (_req, res) => {
    const uploaded = db.prepare('SELECT * FROM media_assets ORDER BY id DESC').all() as any[];
    const products = db.prepare('SELECT id, title, main_image, gallery_images FROM products').all() as any[];
    const categories = db.prepare('SELECT id, name, image_key FROM categories').all() as any[];
    const blogs = db.prepare('SELECT id, title, cover_image FROM blog_posts').all() as any[];

    const findUsage = (urlOrKey: string) => {
      const refs: Array<{ type: string; id: number; title: string }> = [];
      for (const p of products) {
        if (p.main_image === urlOrKey || (p.gallery_images && p.gallery_images.includes(urlOrKey))) {
          refs.push({ type: 'product', id: p.id, title: p.title });
        }
      }
      for (const c of categories) {
        if (c.image_key === urlOrKey) {
          refs.push({ type: 'category', id: c.id, title: c.name });
        }
      }
      for (const b of blogs) {
        if (b.cover_image === urlOrKey) {
          refs.push({ type: 'blog', id: b.id, title: b.title });
        }
      }
      return refs;
    };

    const uploadedWithUsage = uploaded.map((m) => ({
      ...m,
      source: 'uploaded',
      usage: findUsage(m.url),
    }));

    const builtins = BUILTIN_MEDIA_METADATA.map((b) => ({
      id: b.key,
      filename: b.key,
      original_name: b.title,
      mime_type: 'image/jpeg',
      size_bytes: 0,
      url: b.key,
      alt_text: b.title,
      caption: 'تصویر استاندارد آماده فروشگاه',
      folder: b.folder,
      source: 'builtin',
      usage: findUsage(b.key),
    }));

    res.json({ uploaded: uploadedWithUsage, builtins });
  });

  app.post('/api/admin/media/upload', requireAdmin, requirePermission('media.manage'), uploadMedia.array('files', 10), (req: AuthedRequest, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'حداقل یک فایل تصویری معتبر انتخاب کنید.' });
      return;
    }

    const folder = String(req.body?.folder || 'products');
    const altText = String(req.body?.alt_text || '').trim();
    const caption = String(req.body?.caption || '').trim();

    const created: any[] = [];
    const ins = db.prepare(`
      INSERT INTO media_assets (filename, original_name, mime_type, size_bytes, url, alt_text, caption, folder, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of files) {
      sanitizeSvgFileIfNeeded(f.path, f.mimetype);
      const url = `/api/media/${f.filename}`;
      const r = ins.run(
        f.filename,
        f.originalname,
        f.mimetype,
        f.size,
        url,
        altText || path.parse(f.originalname).name,
        caption,
        folder,
        req.user.id
      );
      created.push(db.prepare('SELECT * FROM media_assets WHERE id = ?').get(r.lastInsertRowid));
    }

    logActivity(req.user.id, 'upload_media', 'media', created[0]?.id || null, `آپلود ${files.length} تصویر جدید در کتابخانه رسانه`);
    res.json({ ok: true, assets: created });
  });

  app.patch('/api/admin/media/:id', requireAdmin, requirePermission('media.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as any;
    if (!asset) {
      res.status(404).json({ error: 'فایل رسانه یافت نشد.' });
      return;
    }
    const { alt_text, caption, folder } = req.body || {};
    db.prepare('UPDATE media_assets SET alt_text = ?, caption = ?, folder = ? WHERE id = ?').run(
      alt_text ?? asset.alt_text,
      caption ?? asset.caption,
      folder ?? asset.folder,
      id
    );
    res.json({ ok: true, asset: db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) });
  });

  app.delete('/api/admin/media/:id', requireAdmin, requirePermission('media.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as any;
    if (!asset) {
      res.status(404).json({ error: 'تصویر یافت نشد.' });
      return;
    }

    const usedInProducts = db.prepare('SELECT id, title FROM products WHERE main_image = ? OR gallery_images LIKE ?').all(asset.url, `%${asset.url}%`) as any[];
    if (usedInProducts.length > 0 && req.query.force !== '1') {
      res.status(409).json({
        error: `این تصویر در ${usedInProducts.length} محصول (${usedInProducts.map((p) => p.title).join('، ')}) استفاده شده است. ابتدا تصویر محصولات را تغییر دهید یا حذف اجباری را تایید کنید.`,
        used_in: usedInProducts,
      });
      return;
    }

    const filePath = path.join(UPLOAD_MEDIA_DIR, path.basename(asset.filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
    logActivity(req.user.id, 'delete_media', 'media', id, `حذف فایل رسانه: ${asset.original_name}`);
    res.json({ ok: true });
  });

  // ========================
  // 3. PRODUCTS FULL CRUD + VARIANTS
  // ========================
  app.get('/api/admin/products', requireAdmin, requirePermission('products.view'), (req, res) => {
    const q = String(req.query.q || '').trim();
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const brandId = req.query.brand_id ? Number(req.query.brand_id) : null;
    const published = req.query.published;
    const stockStatus = String(req.query.stock_status || '');

    let sql = `
      SELECT p.*, c.name as category_name, b.name as brand_name,
             (SELECT sm.seo_score FROM seo_metadata sm WHERE sm.url_path = '/product/' || p.slug LIMIT 1) as seo_score
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      sql += ' AND (p.title LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (brandId) {
      sql += ' AND p.brand_id = ?';
      params.push(brandId);
    }
    if (published === '1' || published === '0') {
      sql += ' AND p.is_published = ?';
      params.push(Number(published));
    }

    sql += ' ORDER BY p.id DESC';
    const products = db.prepare(sql).all(...params) as any[];

    const enriched = products
      .map((p) => {
        const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC').all(p.id) as any[];
        const totalAvailable = variants.reduce((s, v) => s + Math.max(0, v.stock_quantity - v.reserved_quantity), 0);
        return {
          ...p,
          gallery_images: (() => {
            try { return JSON.parse(p.gallery_images || '[]'); } catch { return []; }
          })(),
          specifications: (() => {
            try { return JSON.parse(p.specifications || '{}'); } catch { return {}; }
          })(),
          complementary_ids: (() => {
            try { return JSON.parse(p.complementary_ids || '[]'); } catch { return []; }
          })(),
          tags: (() => {
            try { return JSON.parse(p.tags || '[]'); } catch { return []; }
          })(),
          variants,
          total_available_stock: totalAvailable,
        };
      })
      .filter((p) => {
        if (stockStatus === 'out') return p.total_available_stock <= 0;
        if (stockStatus === 'low') return p.total_available_stock > 0 && p.total_available_stock <= 10;
        if (stockStatus === 'in') return p.total_available_stock > 10;
        return true;
      });

    res.json({ products: enriched });
  });

  app.post('/api/admin/products', requireAdmin, requirePermission('products.create'), (req: AuthedRequest, res) => {
    try {
      const {
        title, slug, sku, category_id, brand_id, manufacturer, short_description, description,
        main_image, main_image_alt, gallery_images, unit_type, unit_label_fa,
        min_order_qty, order_step_qty, max_order_qty, weight_grams,
        specifications, complementary_ids, tags, shipping_class, is_fragile,
        is_published, is_featured, is_bestseller, is_new, variants,
      } = req.body || {};

      if (!title?.trim() || !slug?.trim() || !sku?.trim() || !category_id) {
        res.status(400).json({ error: 'عنوان، اسلاگ، کد SKU و دسته‌بندی الزامی است.' });
        return;
      }

      const productId = withTransaction(() => {
        const pRes = db.prepare(`
          INSERT INTO products (
            title, slug, sku, category_id, brand_id, manufacturer, short_description, description,
            main_image, main_image_alt, gallery_images, unit_type, unit_label_fa, min_order_qty, order_step_qty, max_order_qty,
            weight_grams, specifications, complementary_ids, tags, shipping_class, is_fragile,
            is_published, is_featured, is_bestseller, is_new
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          title.trim(),
          slug.trim(),
          sku.trim(),
          Number(category_id),
          brand_id ? Number(brand_id) : null,
          manufacturer?.trim() || null,
          short_description?.trim() || title.trim(),
          description?.trim() || short_description?.trim() || title.trim(),
          main_image?.trim() || 'prod_arabica_beans',
          main_image_alt?.trim() || title.trim(),
          JSON.stringify(Array.isArray(gallery_images) ? gallery_images : [main_image?.trim() || 'prod_arabica_beans']),
          unit_type || 'piece',
          unit_label_fa?.trim() || 'عدد',
          Math.max(1, Number(min_order_qty) || 1),
          Math.max(1, Number(order_step_qty) || 1),
          max_order_qty ? Number(max_order_qty) : null,
          Math.max(10, Number(weight_grams) || 500),
          JSON.stringify(specifications && typeof specifications === 'object' ? specifications : {}),
          JSON.stringify(Array.isArray(complementary_ids) ? complementary_ids.map(Number) : []),
          JSON.stringify(Array.isArray(tags) ? tags : []),
          shipping_class || 'standard',
          is_fragile ? 1 : 0,
          is_published !== undefined ? (is_published ? 1 : 0) : 1,
          is_featured ? 1 : 0,
          is_bestseller ? 1 : 0,
          is_new !== undefined ? (is_new ? 1 : 0) : 1
        );
        const pid = Number(pRes.lastInsertRowid);

        const varList = Array.isArray(variants) && variants.length > 0 ? variants : [{
          sku: `${sku.trim()}-V1`,
          variant_title: 'بسته‌بندی استاندارد',
          regular_price: 500000,
          discount_price: null,
          wholesale_price: 425000,
          cost_price: 350000,
          stock_quantity: 20,
          min_stock_alert: 10,
          warehouse_location: 'انبار مرکزی تهران',
        }];

        const insVar = db.prepare(`
          INSERT INTO product_variants (
            product_id, sku, barcode, variant_title, regular_price, discount_price, wholesale_price, cost_price,
            stock_quantity, min_stock_alert, warehouse_location, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);
        const insMove = db.prepare(`
          INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, reference_id, note, created_by)
          VALUES (?, 'in', ?, 0, ?, 'initial_stock', ?, ?, ?)
        `);

        for (const v of varList) {
          const qty = Math.max(0, Number(v.stock_quantity) || 0);
          const vRes = insVar.run(
            pid,
            v.sku?.trim() || `${sku.trim()}-${Date.now().toString().slice(-4)}`,
            v.barcode?.trim() || null,
            v.variant_title?.trim() || 'استاندارد',
            Math.max(0, Number(v.regular_price) || 0),
            v.discount_price !== undefined && v.discount_price !== null && v.discount_price !== '' ? Number(v.discount_price) : null,
            v.wholesale_price !== undefined && v.wholesale_price !== null && v.wholesale_price !== '' ? Number(v.wholesale_price) : null,
            v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '' ? Number(v.cost_price) : null,
            qty,
            Math.max(1, Number(v.min_stock_alert) || 10),
            v.warehouse_location?.trim() || 'انبار مرکزی تهران'
          );
          if (qty > 0) {
            insMove.run(Number(vRes.lastInsertRowid), qty, qty, pid, `موجودی اولیه هنگام ایجاد محصول ${title.trim()}`, req.user.id);
          }
        }

        const urlPath = `/product/${slug.trim()}`;
        const seoTitle = `خرید و قیمت ${title.trim()} | باریستاپرو`;
        const metaDesc = (short_description || title).slice(0, 155);
        const audit = analyzeSeoContent({
          url_path: urlPath,
          seo_title: seoTitle,
          meta_description: metaDesc,
          focus_keyword: title.trim().split(' ').slice(0, 2).join(' '),
          content_text: `${short_description || ''} ${description || ''}`,
          schema_type: 'Product',
        });
        db.prepare(`
          INSERT OR REPLACE INTO seo_metadata (entity_type, entity_id, url_path, seo_title, meta_description, focus_keyword, schema_type, seo_score, analysis_json)
          VALUES ('product', ?, ?, ?, ?, ?, 'Product', ?, ?)
        `).run(pid, urlPath, seoTitle, metaDesc, title.trim().split(' ').slice(0, 2).join(' '), audit.score, JSON.stringify(audit));

        logActivity(req.user.id, 'create_product', 'product', pid, `ایجاد محصول جدید: ${title.trim()}`);
        return pid;
      });

      res.json({ ok: true, id: productId });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'خطا در ایجاد محصول.' });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, requirePermission('products.update'), (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'محصول یافت نشد.' });
        return;
      }

      const {
        title, slug, sku, category_id, brand_id, manufacturer, short_description, description,
        main_image, main_image_alt, gallery_images, unit_type, unit_label_fa,
        min_order_qty, order_step_qty, max_order_qty, weight_grams,
        specifications, complementary_ids, tags, shipping_class, is_fragile,
        is_published, is_featured, is_bestseller, is_new, variants,
        create_redirect_on_slug_change,
      } = req.body || {};

      const newSlug = slug?.trim() || existing.slug;

      withTransaction(() => {
        db.prepare(`
          UPDATE products
          SET title = ?, slug = ?, sku = ?, category_id = ?, brand_id = ?, manufacturer = ?,
              short_description = ?, description = ?, main_image = ?, main_image_alt = ?,
              gallery_images = ?, unit_type = ?, unit_label_fa = ?, min_order_qty = ?, order_step_qty = ?, max_order_qty = ?,
              weight_grams = ?, specifications = ?, complementary_ids = ?, tags = ?, shipping_class = ?, is_fragile = ?,
              is_published = ?, is_featured = ?, is_bestseller = ?, is_new = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          title?.trim() || existing.title,
          newSlug,
          sku?.trim() || existing.sku,
          category_id !== undefined ? Number(category_id) : existing.category_id,
          brand_id !== undefined ? (brand_id ? Number(brand_id) : null) : existing.brand_id,
          manufacturer !== undefined ? (manufacturer?.trim() || null) : existing.manufacturer,
          short_description !== undefined ? short_description : existing.short_description,
          description !== undefined ? description : existing.description,
          main_image !== undefined ? (main_image?.trim() || existing.main_image) : existing.main_image,
          main_image_alt !== undefined ? (main_image_alt?.trim() || '') : existing.main_image_alt,
          gallery_images !== undefined ? JSON.stringify(Array.isArray(gallery_images) ? gallery_images : []) : existing.gallery_images,
          unit_type ?? existing.unit_type,
          unit_label_fa ?? existing.unit_label_fa,
          min_order_qty !== undefined ? Math.max(1, Number(min_order_qty) || 1) : existing.min_order_qty,
          order_step_qty !== undefined ? Math.max(1, Number(order_step_qty) || 1) : existing.order_step_qty,
          max_order_qty !== undefined ? (max_order_qty ? Number(max_order_qty) : null) : existing.max_order_qty,
          weight_grams !== undefined ? Math.max(10, Number(weight_grams) || 500) : existing.weight_grams,
          specifications !== undefined ? JSON.stringify(specifications || {}) : existing.specifications,
          complementary_ids !== undefined ? JSON.stringify(Array.isArray(complementary_ids) ? complementary_ids.map(Number) : []) : existing.complementary_ids,
          tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : existing.tags,
          shipping_class ?? existing.shipping_class,
          is_fragile !== undefined ? (is_fragile ? 1 : 0) : existing.is_fragile,
          is_published !== undefined ? (is_published ? 1 : 0) : existing.is_published,
          is_featured !== undefined ? (is_featured ? 1 : 0) : existing.is_featured,
          is_bestseller !== undefined ? (is_bestseller ? 1 : 0) : existing.is_bestseller,
          is_new !== undefined ? (is_new ? 1 : 0) : existing.is_new,
          id
        );

        // Update / Insert / Remove variants if provided
        if (Array.isArray(variants) && variants.length > 0) {
          const existingVars = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(id) as any[];
          const incomingIds = new Set<number>();

          for (const v of variants) {
            if (v.id && existingVars.some((ev) => ev.id === Number(v.id))) {
              const ev = existingVars.find((x) => x.id === Number(v.id));
              incomingIds.add(ev.id);
              const nextStock = Math.max(0, Number(v.stock_quantity ?? ev.stock_quantity));
              const delta = nextStock - ev.stock_quantity;

              db.prepare(`
                UPDATE product_variants
                SET sku = ?, barcode = ?, variant_title = ?, regular_price = ?, discount_price = ?,
                    wholesale_price = ?, cost_price = ?, stock_quantity = ?, min_stock_alert = ?,
                    warehouse_location = ?, is_active = ?
                WHERE id = ?
              `).run(
                v.sku?.trim() || ev.sku,
                v.barcode?.trim() || null,
                v.variant_title?.trim() || ev.variant_title,
                Math.max(0, Number(v.regular_price ?? ev.regular_price)),
                v.discount_price !== undefined && v.discount_price !== null && v.discount_price !== '' ? Number(v.discount_price) : null,
                v.wholesale_price !== undefined && v.wholesale_price !== null && v.wholesale_price !== '' ? Number(v.wholesale_price) : null,
                v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '' ? Number(v.cost_price) : null,
                nextStock,
                Math.max(1, Number(v.min_stock_alert ?? ev.min_stock_alert ?? 10)),
                v.warehouse_location?.trim() || ev.warehouse_location || 'انبار مرکزی تهران',
                v.is_active !== undefined ? (v.is_active ? 1 : 0) : ev.is_active,
                ev.id
              );

              if (delta !== 0) {
                db.prepare(`
                  INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, reference_id, note, created_by)
                  VALUES (?, 'adjustment', ?, ?, ?, 'product_editor', ?, 'اصلاح موجودی در ویرایشگر محصول', ?)
                `).run(ev.id, delta, ev.stock_quantity, nextStock, id, req.user.id);
              }
            } else {
              const qty = Math.max(0, Number(v.stock_quantity) || 0);
              const vRes = db.prepare(`
                INSERT INTO product_variants (
                  product_id, sku, barcode, variant_title, regular_price, discount_price, wholesale_price, cost_price,
                  stock_quantity, min_stock_alert, warehouse_location, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
              `).run(
                id,
                v.sku?.trim() || `${existing.sku}-V${Date.now().toString().slice(-3)}`,
                v.barcode?.trim() || null,
                v.variant_title?.trim() || 'تنوع جدید',
                Math.max(0, Number(v.regular_price) || 0),
                v.discount_price !== undefined && v.discount_price !== null && v.discount_price !== '' ? Number(v.discount_price) : null,
                v.wholesale_price !== undefined && v.wholesale_price !== null && v.wholesale_price !== '' ? Number(v.wholesale_price) : null,
                v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '' ? Number(v.cost_price) : null,
                qty,
                Math.max(1, Number(v.min_stock_alert) || 10),
                v.warehouse_location?.trim() || 'انبار مرکزی تهران'
              );
              const newVid = Number(vRes.lastInsertRowid);
              incomingIds.add(newVid);
              if (qty > 0) {
                db.prepare(`
                  INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, reference_id, note, created_by)
                  VALUES (?, 'in', ?, 0, ?, 'variant_created', ?, 'افزودن تنوع جدید محصول', ?)
                `).run(newVid, qty, qty, id, req.user.id);
              }
            }
          }

          // Remove or deactivate variants excluded from editor list
          for (const ev of existingVars) {
            if (!incomingIds.has(ev.id)) {
              const usedInOrder = (db.prepare('SELECT COUNT(*) as cnt FROM order_items WHERE variant_id = ?').get(ev.id) as any).cnt;
              if (usedInOrder > 0) {
                db.prepare('UPDATE product_variants SET is_active = 0 WHERE id = ?').run(ev.id);
              } else {
                db.prepare('DELETE FROM product_variants WHERE id = ?').run(ev.id);
              }
            }
          }
        }

        if (newSlug !== existing.slug) {
          const oldUrl = `/product/${existing.slug}`;
          const newUrl = `/product/${newSlug}`;
          db.prepare('UPDATE seo_metadata SET url_path = ? WHERE url_path = ?').run(newUrl, oldUrl);
          db.prepare('UPDATE navigation_items SET target_slug = ?, target_url = ? WHERE link_type = ? AND target_slug = ?').run(
            newSlug, newUrl, 'product', existing.slug
          );
          if (create_redirect_on_slug_change !== false) {
            db.prepare('INSERT OR REPLACE INTO seo_redirects (source_path, target_path, status_code, is_active) VALUES (?, ?, 301, 1)').run(oldUrl, newUrl);
          }
        }

        logActivity(req.user.id, 'update_product', 'product', id, `ویرایش کامل محصول: ${title || existing.title}`);
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'خطا در بروزرسانی محصول.' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, requirePermission('products.delete'), (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!product) {
        res.status(404).json({ error: 'محصول یافت نشد.' });
        return;
      }

      const orderCount = (db.prepare('SELECT COUNT(*) as cnt FROM order_items WHERE product_id = ?').get(id) as any).cnt;
      if (orderCount > 0 && req.query.archive !== '1') {
        res.status(409).json({
          has_orders: true,
          order_count: orderCount,
          error: `این محصول در ${orderCount} سفارش ثبت‌شده وجود دارد و جهت حفظ صحت اسناد مالی قابل حذف کامل نیست. می‌توانید آن را به‌صورت امن آرشیو و مخفی کنید.`,
        });
        return;
      }

      withTransaction(() => {
        if (orderCount > 0) {
          db.prepare('UPDATE products SET is_published = 0, is_featured = 0, is_bestseller = 0 WHERE id = ?').run(id);
          db.prepare('UPDATE navigation_items SET is_active = 0 WHERE link_type = ? AND target_slug = ?').run('product', product.slug);
          logActivity(req.user.id, 'archive_product', 'product', id, `آرشیو امن محصول دارای سابقه سفارش: ${product.title}`);
        } else {
          db.prepare('DELETE FROM seo_metadata WHERE url_path = ?').run(`/product/${product.slug}`);
          db.prepare('DELETE FROM navigation_items WHERE link_type = ? AND target_slug = ?').run('product', product.slug);
          db.prepare('DELETE FROM products WHERE id = ?').run(id);
          logActivity(req.user.id, 'delete_product', 'product', id, `حذف کامل محصول: ${product.title}`);
        }
      });

      res.json({ ok: true, archived: orderCount > 0 });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'خطا در حذف محصول.' });
    }
  });

  // ========================
  // 4. CATEGORIES & BRANDS CRUD
  // ========================
  app.get('/api/admin/categories', requireAdmin, requirePermission('categories.manage'), (_req, res) => {
    const categories = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
      FROM categories c ORDER BY c.display_order ASC, c.id ASC
    `).all();
    res.json({ categories });
  });

  app.post('/api/admin/categories', requireAdmin, requirePermission('categories.manage'), (req: AuthedRequest, res) => {
    try {
      const { name, slug, parent_id, description, image_key, display_order, is_active, seo_title, meta_description } = req.body || {};
      if (!name?.trim() || !slug?.trim()) {
        res.status(400).json({ error: 'نام و اسلاگ دسته‌بندی الزامی است.' });
        return;
      }
      const r = db.prepare(`
        INSERT INTO categories (name, slug, parent_id, description, image_key, display_order, is_active, seo_title, meta_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        slug.trim(),
        parent_id ? Number(parent_id) : null,
        description?.trim() || '',
        image_key?.trim() || 'prod_arabica_beans',
        Number(display_order) || 0,
        is_active === false ? 0 : 1,
        seo_title?.trim() || null,
        meta_description?.trim() || null
      );
      const cid = Number(r.lastInsertRowid);
      const urlPath = `/category/${slug.trim()}`;
      const sTitle = seo_title?.trim() || `خرید ${name.trim()} با قیمت عمده کافه | باریستاپرو`;
      const sDesc = meta_description?.trim() || description?.trim() || `مرجع تخصصی خرید ${name.trim()}`;
      const audit = analyzeSeoContent({ url_path: urlPath, seo_title: sTitle, meta_description: sDesc, focus_keyword: name.trim(), content_text: sDesc, schema_type: 'WebPage' });
      db.prepare(`
        INSERT OR IGNORE INTO seo_metadata (entity_type, entity_id, url_path, seo_title, meta_description, focus_keyword, schema_type, seo_score, analysis_json)
        VALUES ('category', ?, ?, ?, ?, ?, 'WebPage', ?, ?)
      `).run(cid, urlPath, sTitle, sDesc, name.trim(), audit.score, JSON.stringify(audit));

      logActivity(req.user.id, 'create_category', 'category', cid, `ایجاد دسته‌بندی: ${name.trim()}`);
      res.json({ ok: true, id: cid });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'خطا در ایجاد دسته‌بندی.' });
    }
  });

  app.put('/api/admin/categories/:id', requireAdmin, requirePermission('categories.manage'), (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
      const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'دسته‌بندی یافت نشد.' });
        return;
      }
      const { name, slug, parent_id, description, image_key, display_order, is_active, seo_title, meta_description } = req.body || {};
      if (parent_id && Number(parent_id) === id) {
        res.status(400).json({ error: 'دسته‌بندی نمی‌تواند والد خودش باشد.' });
        return;
      }
      db.prepare(`
        UPDATE categories
        SET name = ?, slug = ?, parent_id = ?, description = ?, image_key = ?, display_order = ?, is_active = ?, seo_title = ?, meta_description = ?
        WHERE id = ?
      `).run(
        name?.trim() || existing.name,
        slug?.trim() || existing.slug,
        parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : existing.parent_id,
        description !== undefined ? description : existing.description,
        image_key !== undefined ? image_key : existing.image_key,
        display_order !== undefined ? Number(display_order) : existing.display_order,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        seo_title !== undefined ? seo_title : existing.seo_title,
        meta_description !== undefined ? meta_description : existing.meta_description,
        id
      );
      logActivity(req.user.id, 'update_category', 'category', id, `ویرایش دسته‌بندی: ${name || existing.name}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/categories/:id', requireAdmin, requirePermission('categories.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const prodCount = (db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?').get(id) as any).cnt;
    if (prodCount > 0) {
      res.status(409).json({ error: `این دسته‌بندی شامل ${prodCount} محصول است. ابتدا محصولات را به دسته دیگری منتقل کنید.` });
      return;
    }
    db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    logActivity(req.user.id, 'delete_category', 'category', id, `حذف دسته‌بندی #${id}`);
    res.json({ ok: true });
  });

  app.get('/api/admin/brands', requireAdmin, requirePermission('categories.manage'), (_req, res) => {
    const brands = db.prepare(`
      SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as product_count
      FROM brands b ORDER BY b.id DESC
    `).all();
    res.json({ brands });
  });

  app.post('/api/admin/brands', requireAdmin, requirePermission('categories.manage'), (req: AuthedRequest, res) => {
    try {
      const { name, slug, country, description, logo_url, website, is_active } = req.body || {};
      if (!name?.trim() || !slug?.trim()) {
        res.status(400).json({ error: 'نام و اسلاگ برند الزامی است.' });
        return;
      }
      const r = db.prepare(`
        INSERT INTO brands (name, slug, country, description, logo_url, website, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(name.trim(), slug.trim(), country?.trim() || '', description?.trim() || '', logo_url?.trim() || null, website?.trim() || null, is_active === false ? 0 : 1);
      logActivity(req.user.id, 'create_brand', 'brand', Number(r.lastInsertRowid), `ایجاد برند: ${name.trim()}`);
      res.json({ ok: true, id: Number(r.lastInsertRowid) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/brands/:id', requireAdmin, requirePermission('categories.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM brands WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'برند یافت نشد.' });
      return;
    }
    const { name, slug, country, description, logo_url, website, is_active } = req.body || {};
    db.prepare(`
      UPDATE brands SET name = ?, slug = ?, country = ?, description = ?, logo_url = ?, website = ?, is_active = ? WHERE id = ?
    `).run(
      name?.trim() || existing.name,
      slug?.trim() || existing.slug,
      country !== undefined ? country : existing.country,
      description !== undefined ? description : existing.description,
      logo_url !== undefined ? logo_url : existing.logo_url,
      website !== undefined ? website : existing.website,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id
    );
    logActivity(req.user.id, 'update_brand', 'brand', id, `ویرایش برند: ${name || existing.name}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/brands/:id', requireAdmin, requirePermission('categories.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('UPDATE products SET brand_id = NULL WHERE brand_id = ?').run(id);
    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    logActivity(req.user.id, 'delete_brand', 'brand', id, `حذف برند #${id}`);
    res.json({ ok: true });
  });

  // ========================
  // 5. INVENTORY MOVEMENTS & ADJUSTMENTS
  // ========================
  app.get('/api/admin/inventory/movements', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    const limit = Math.min(200, Math.max(20, Number(req.query.limit) || 100));
    const movements = db.prepare(`
      SELECT im.*, pv.sku, pv.variant_title, pv.warehouse_location, p.title as product_title, u.name as actor_name
      FROM inventory_movements im
      JOIN product_variants pv ON pv.id = im.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN users u ON u.id = im.created_by
      ORDER BY im.id DESC
      LIMIT ?
    `).all(limit);
    res.json({ movements });
  });

  app.post('/api/admin/inventory/adjust', requireAdmin, requirePermission('inventory.adjust'), (req: AuthedRequest, res) => {
    try {
      const { variant_id, movement_type, quantity, reason, warehouse_location } = req.body || {};
      const qty = Math.floor(Number(quantity) || 0);
      if (!variant_id || qty <= 0 || !reason?.trim()) {
        res.status(400).json({ error: 'تنوع کالا، مقدار عددی مثبت و دلیل ثبت حرکت انبار الزامی است.' });
        return;
      }

      const result = withTransaction(() => {
        const variant = db.prepare(`
          SELECT pv.*, p.title as product_title FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ?
        `).get(Number(variant_id)) as any;
        if (!variant) throw new Error('تنوع کالا یافت نشد.');

        const prevStock = variant.stock_quantity;
        let delta = 0;
        let dbType: 'in' | 'out' | 'adjustment' = 'adjustment';

        if (movement_type === 'purchase_receipt' || movement_type === 'manual_increase' || movement_type === 'customer_return') {
          delta = qty;
          dbType = 'in';
        } else if (movement_type === 'manual_decrease' || movement_type === 'damage') {
          delta = -qty;
          dbType = 'out';
        } else if (movement_type === 'stock_correction') {
          delta = qty - prevStock;
          dbType = 'adjustment';
        } else {
          delta = qty;
          dbType = 'adjustment';
        }

        const nextStock = Math.max(0, prevStock + delta);
        if (nextStock < variant.reserved_quantity) {
          throw new Error(`موجودی جدید نمی‌تواند کمتر از تعداد رزروشده فعلی (${variant.reserved_quantity}) باشد.`);
        }

        db.prepare('UPDATE product_variants SET stock_quantity = ?, warehouse_location = COALESCE(?, warehouse_location) WHERE id = ?').run(
          nextStock,
          warehouse_location?.trim() || null,
          variant.id
        );

        db.prepare(`
          INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, note, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(variant.id, dbType, delta, prevStock, nextStock, movement_type || 'manual_adjustment', reason.trim(), req.user.id);

        if (nextStock <= (variant.min_stock_alert || 10)) {
          createNotification(null, `هشدار کمبود موجودی: ${variant.product_title}`, `موجودی ${variant.sku} به ${nextStock} عدد رسید.`);
        }

        logActivity(req.user.id, 'inventory_movement', 'product_variant', variant.id, `ثبت حرکت انبار (${movement_type}) برای ${variant.sku}: ${prevStock} -> ${nextStock} (${reason.trim()})`);
        return { previous_quantity: prevStock, new_quantity: nextStock };
      });

      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ========================
  // 6. ORDERS, CANCEL, REFUND, PAYMENTS, SHIPPING & EXPORTS
  // ========================
  app.post('/api/admin/orders/:id/cancel', requireAdmin, requirePermission('orders.cancel_refund'), (req: AuthedRequest, res) => {
    try {
      const result = cancelOrderWithStockRestore(Number(req.params.id), req.user.id, req.body?.reason || '');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/orders/:id/refund', requireAdmin, requirePermission('orders.cancel_refund'), (req: AuthedRequest, res) => {
    try {
      const result = recordOrderRefund(Number(req.params.id), req.user.id, Number(req.body?.amount), req.body?.note || '');
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/admin/payments', requireAdmin, requirePermission('payments.view'), (_req, res) => {
    const payments = db.prepare(`
      SELECT p.*, o.order_number, o.customer_name, o.customer_mobile, o.status as order_status, u.name as verifier_name
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      LEFT JOIN users u ON u.id = p.verified_by
      ORDER BY p.id DESC
    `).all();
    res.json({ payments });
  });

  app.get('/api/admin/shipping-methods', requireAdmin, requirePermission('shipping.manage'), (_req, res) => {
    res.json({ methods: db.prepare('SELECT * FROM shipping_methods ORDER BY id ASC').all() });
  });

  app.post('/api/admin/shipping-methods', requireAdmin, requirePermission('shipping.manage'), (req: AuthedRequest, res) => {
    const { title, description, calc_type, base_cost, per_kg_cost, free_threshold, estimated_days, is_active } = req.body || {};
    if (!title?.trim()) {
      res.status(400).json({ error: 'عنوان روش ارسال الزامی است.' });
      return;
    }
    const r = db.prepare(`
      INSERT INTO shipping_methods (title, description, calc_type, base_cost, per_kg_cost, free_threshold, estimated_days, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description?.trim() || '',
      ['fixed', 'weight_based', 'free_above'].includes(calc_type) ? calc_type : 'fixed',
      Math.max(0, Number(base_cost) || 0),
      Math.max(0, Number(per_kg_cost) || 0),
      free_threshold ? Number(free_threshold) : null,
      estimated_days?.trim() || '۱ تا ۲ روز کاری',
      is_active === false ? 0 : 1
    );
    logActivity(req.user.id, 'create_shipping', 'shipping_method', Number(r.lastInsertRowid), `ایجاد روش ارسال: ${title.trim()}`);
    res.json({ ok: true });
  });

  app.put('/api/admin/shipping-methods/:id', requireAdmin, requirePermission('shipping.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'روش ارسال یافت نشد.' });
      return;
    }
    const { title, description, calc_type, base_cost, per_kg_cost, free_threshold, estimated_days, is_active } = req.body || {};
    db.prepare(`
      UPDATE shipping_methods
      SET title = ?, description = ?, calc_type = ?, base_cost = ?, per_kg_cost = ?, free_threshold = ?, estimated_days = ?, is_active = ?
      WHERE id = ?
    `).run(
      title?.trim() || existing.title,
      description ?? existing.description,
      ['fixed', 'weight_based', 'free_above'].includes(calc_type) ? calc_type : existing.calc_type,
      base_cost !== undefined ? Math.max(0, Number(base_cost)) : existing.base_cost,
      per_kg_cost !== undefined ? Math.max(0, Number(per_kg_cost)) : existing.per_kg_cost,
      free_threshold !== undefined ? (free_threshold ? Number(free_threshold) : null) : existing.free_threshold,
      estimated_days ?? existing.estimated_days,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id
    );
    logActivity(req.user.id, 'update_shipping', 'shipping_method', id, `ویرایش روش ارسال: ${title || existing.title}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/shipping-methods/:id', requireAdmin, requirePermission('shipping.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const orderCount = (db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE shipping_method_id = ?').get(id) as any).cnt;
    if (orderCount > 0) {
      db.prepare('UPDATE shipping_methods SET is_active = 0 WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM shipping_methods WHERE id = ?').run(id);
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/export/:type', requireAdmin, requirePermission('reports.export'), (req: AuthedRequest, res) => {
    const t = req.params.type;
    let csv = '';
    if (t === 'orders') {
      const rows = db.prepare('SELECT order_number, customer_name, customer_mobile, status, payment_method, subtotal_amount, shipping_fee, coupon_discount_amount, total_payable, refunded_amount, created_at FROM orders ORDER BY id DESC').all() as any[];
      csv = buildCsv(
        ['شماره سفارش', 'مشتری', 'موبایل', 'وضعیت', 'روش پرداخت', 'جمع اقلام', 'حمل', 'تخفیف کوپن', 'مبلغ نهایی', 'استرداد', 'تاریخ'],
        rows.map((r) => [r.order_number, r.customer_name, r.customer_mobile, r.status, r.payment_method, r.subtotal_amount, r.shipping_fee, r.coupon_discount_amount, r.total_payable, r.refunded_amount, r.created_at])
      );
    } else if (t === 'products') {
      const rows = db.prepare(`
        SELECT p.id, p.title, p.sku, c.name as category_name, pv.sku as variant_sku, pv.variant_title, pv.regular_price, pv.discount_price, pv.wholesale_price, pv.stock_quantity, pv.reserved_quantity
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        ORDER BY p.id DESC
      `).all() as any[];
      csv = buildCsv(
        ['شناسه', 'عنوان محصول', 'کد کالا', 'دسته', 'کد تنوع', 'تنوع', 'قیمت عادی', 'تخفیف', 'قیمت عمده', 'موجودی کل', 'رزرو'],
        rows.map((r) => [r.id, r.title, r.sku, r.category_name, r.variant_sku, r.variant_title, r.regular_price, r.discount_price || '', r.wholesale_price || '', r.stock_quantity, r.reserved_quantity])
      );
    } else if (t === 'customers') {
      const rows = db.prepare(`
        SELECT u.id, u.name, u.mobile, u.email, u.cafe_name, u.customer_group, u.wholesale_status, u.status, u.created_at
        FROM users u WHERE u.role = 'customer' ORDER BY u.id DESC
      `).all() as any[];
      csv = buildCsv(
        ['شناسه', 'نام', 'موبایل', 'ایمیل', 'نام کافه', 'گروه', 'وضعیت عمده', 'وضعیت', 'تاریخ عضویت'],
        rows.map((r) => [r.id, r.name, r.mobile, r.email || '', r.cafe_name || '', r.customer_group, r.wholesale_status, r.status, r.created_at])
      );
    } else if (t === 'inventory') {
      const rows = db.prepare(`
        SELECT im.id, p.title, pv.sku, im.type, im.reference_type, im.quantity_delta, im.previous_quantity, im.new_quantity, im.note, im.created_at
        FROM inventory_movements im
        JOIN product_variants pv ON pv.id = im.variant_id
        JOIN products p ON p.id = pv.product_id
        ORDER BY im.id DESC LIMIT 500
      `).all() as any[];
      csv = buildCsv(
        ['شناسه', 'محصول', 'SKU', 'نوع', 'علت مرجع', 'تغییر', 'قبلی', 'جدید', 'توضیح', 'تاریخ'],
        rows.map((r) => [r.id, r.title, r.sku, r.type, r.reference_type, r.quantity_delta, r.previous_quantity ?? '', r.new_quantity ?? '', r.note || '', r.created_at])
      );
    } else {
      res.status(400).json({ error: 'نوع گزارش خروجی معتبر نیست.' });
      return;
    }

    logActivity(req.user.id, 'export_csv', 'report', null, `دریافت خروجی CSV گزارش ${t}`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="baristapro-${t}-${Date.now()}.csv"`);
    res.send(csv);
  });

  // ========================
  // 7. CUSTOMERS CRM & WHOLESALE B2B
  // ========================
  app.get('/api/admin/customers/:id', requireAdmin, requirePermission('customers.view'), (req, res) => {
    const id = Number(req.params.id);
    const customer = db.prepare(`
      SELECT id, name, mobile, email, role, status, cafe_name, customer_group, wholesale_status, business_id, credit_limit, payment_terms, internal_notes, created_at
      FROM users WHERE id = ?
    `).get(id) as any;
    if (!customer) {
      res.status(404).json({ error: 'مشتری یافت نشد.' });
      return;
    }
    const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC').all(id);
    const orders = db.prepare('SELECT id, order_number, status, total_payable, payment_method, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(id);
    res.json({ customer, addresses, orders });
  });

  app.patch('/api/admin/customers/:id', requireAdmin, requirePermission('customers.update'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'کاربر یافت نشد.' });
      return;
    }
    const { status, customer_group, wholesale_status, business_id, credit_limit, payment_terms, internal_notes, cafe_name } = req.body || {};

    let nextGroup = customer_group ?? existing.customer_group;
    const nextWholesale = wholesale_status ?? existing.wholesale_status;
    if (wholesale_status === 'approved' && nextGroup === 'regular') {
      nextGroup = 'wholesale';
    }

    db.prepare(`
      UPDATE users
      SET status = ?, customer_group = ?, wholesale_status = ?, business_id = ?, credit_limit = ?, payment_terms = ?, internal_notes = ?, cafe_name = ?
      WHERE id = ?
    `).run(
      status === 'blocked' ? 'blocked' : status === 'active' ? 'active' : existing.status,
      nextGroup,
      nextWholesale,
      business_id !== undefined ? business_id : existing.business_id,
      credit_limit !== undefined ? Math.max(0, Number(credit_limit) || 0) : existing.credit_limit,
      payment_terms !== undefined ? payment_terms : existing.payment_terms,
      internal_notes !== undefined ? internal_notes : existing.internal_notes,
      cafe_name !== undefined ? cafe_name : existing.cafe_name,
      id
    );

    if (wholesale_status && wholesale_status !== existing.wholesale_status) {
      createNotification(
        id,
        wholesale_status === 'approved' ? 'تایید حساب عمده‌فروشی B2B' : 'بروزرسانی وضعیت درخواست عمده‌فروشی',
        wholesale_status === 'approved'
          ? 'حساب کاربری شما به گروه همکار عمده ارتقا یافت و از این پس قیمت عمده محصولات برای شما فعال است.'
          : 'وضعیت درخواست همکاری عمده‌فروشی شما بررسی و بروزرسانی شد.'
      );
    }

    logActivity(req.user.id, 'update_customer', 'user', id, `بروزرسانی پروفایل و گروه مشتری #${id} (${nextGroup} / ${nextWholesale})`);
    res.json({ ok: true });
  });

  // ========================
  // 8. NAVIGATION / HAMBURGER MENU BUILDER & CMS
  // ========================
  app.get('/api/admin/menus', requireAdmin, requirePermission('menus.manage'), (_req, res) => {
    const items = db.prepare('SELECT * FROM navigation_items ORDER BY display_order ASC, id ASC').all();
    res.json({
      items,
      hamburger_show_bestsellers: getSetting('hamburger_show_bestsellers', '1') === '1',
    });
  });

  app.post('/api/admin/menus', requireAdmin, requirePermission('menus.manage'), (req: AuthedRequest, res) => {
    try {
      const { location, label, link_type, target_slug, target_url, display_order, is_active, open_in_new_tab } = req.body || {};
      if (!label?.trim() || !target_url?.trim()) {
        res.status(400).json({ error: 'عنوان نمایشی و آدرس مقصد الزامی است.' });
        return;
      }
      const loc = ['header', 'mobile_drawer', 'footer', 'both'].includes(location) ? location : 'mobile_drawer';
      const lType = ['product', 'category', 'blog', 'page', 'custom'].includes(link_type) ? link_type : 'custom';
      const maxOrderRow = db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM navigation_items').get() as any;

      const r = db.prepare(`
        INSERT INTO navigation_items (location, label, link_type, target_slug, target_url, display_order, is_active, open_in_new_tab)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        loc,
        label.trim(),
        lType,
        target_slug?.trim() || '',
        target_url.trim(),
        display_order !== undefined ? Number(display_order) : Number(maxOrderRow.m) + 1,
        is_active === false ? 0 : 1,
        open_in_new_tab ? 1 : 0
      );
      logActivity(req.user.id, 'create_menu_item', 'navigation_item', Number(r.lastInsertRowid), `افزودن آیتم منو (${loc}): ${label.trim()}`);
      res.json({ ok: true, id: Number(r.lastInsertRowid) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/menus/:id', requireAdmin, requirePermission('menus.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM navigation_items WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'آیتم منو یافت نشد.' });
      return;
    }
    const { location, label, link_type, target_slug, target_url, display_order, is_active, open_in_new_tab } = req.body || {};
    db.prepare(`
      UPDATE navigation_items
      SET location = ?, label = ?, link_type = ?, target_slug = ?, target_url = ?, display_order = ?, is_active = ?, open_in_new_tab = ?
      WHERE id = ?
    `).run(
      location && ['header', 'mobile_drawer', 'footer', 'both'].includes(location) ? location : existing.location,
      label?.trim() || existing.label,
      link_type && ['product', 'category', 'blog', 'page', 'custom'].includes(link_type) ? link_type : existing.link_type,
      target_slug !== undefined ? target_slug : existing.target_slug,
      target_url?.trim() || existing.target_url,
      display_order !== undefined ? Number(display_order) : existing.display_order,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      open_in_new_tab !== undefined ? (open_in_new_tab ? 1 : 0) : existing.open_in_new_tab,
      id
    );
    logActivity(req.user.id, 'update_menu_item', 'navigation_item', id, `ویرایش آیتم منو: ${label || existing.label}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/menus/:id', requireAdmin, requirePermission('menus.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM navigation_items WHERE id = ?').run(id);
    logActivity(req.user.id, 'delete_menu_item', 'navigation_item', id, `حذف آیتم منو #${id}`);
    res.json({ ok: true });
  });

  app.post('/api/admin/menus/reorder', requireAdmin, requirePermission('menus.manage'), (req: AuthedRequest, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    withTransaction(() => {
      const stmt = db.prepare('UPDATE navigation_items SET display_order = ? WHERE id = ?');
      items.forEach((item: { id: number; display_order: number }) => {
        stmt.run(Number(item.display_order), Number(item.id));
      });
      if (req.body?.hamburger_show_bestsellers !== undefined) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'hamburger_show_bestsellers',
          req.body.hamburger_show_bestsellers ? '1' : '0'
        );
      }
    });
    res.json({ ok: true });
  });

  // CMS: Blog Posts, FAQs, Homepage Sections & Hero Banner
  app.get('/api/admin/cms', requireAdmin, requirePermission('cms.manage'), (_req, res) => {
    const posts = db.prepare('SELECT * FROM blog_posts ORDER BY id DESC').all();
    const faqs = db.prepare('SELECT * FROM faqs ORDER BY display_order ASC, id ASC').all();
    let homepageSections = [];
    try {
      homepageSections = JSON.parse(getSetting('homepage_sections', '[]'));
    } catch {
      homepageSections = [];
    }
    res.json({
      posts,
      faqs,
      homepage_sections: homepageSections,
      hero: {
        hero_kicker: getSetting('hero_kicker'),
        hero_title: getSetting('hero_title'),
        hero_subtitle: getSetting('hero_subtitle'),
        hero_image: getSetting('hero_image', 'hero_coffee_roastery'),
        hero_cta_label: getSetting('hero_cta_label', 'مشاهده کاتالوگ محصولات'),
      },
    });
  });

  app.post('/api/admin/cms/blog', requireAdmin, requirePermission('cms.manage'), (req: AuthedRequest, res) => {
    try {
      const { title, slug, category_name, excerpt, content, cover_image, read_time_min, is_published } = req.body || {};
      if (!title?.trim() || !slug?.trim()) {
        res.status(400).json({ error: 'عنوان و اسلاگ مقاله الزامی است.' });
        return;
      }
      const r = db.prepare(`
        INSERT INTO blog_posts (title, slug, category_name, excerpt, content, cover_image, read_time_min, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        slug.trim(),
        category_name?.trim() || 'آموزش باریستا',
        excerpt?.trim() || title.trim(),
        content?.trim() || excerpt?.trim() || title.trim(),
        cover_image?.trim() || 'prod_barista_tools',
        Math.max(1, Number(read_time_min) || 5),
        is_published === false ? 0 : 1
      );
      const bid = Number(r.lastInsertRowid);
      const urlPath = `/blog/${slug.trim()}`;
      const audit = analyzeSeoContent({
        url_path: urlPath,
        seo_title: `${title.trim()} | آکادمی باریستاپرو`,
        meta_description: (excerpt || title).slice(0, 155),
        focus_keyword: title.trim().split(' ').slice(0, 2).join(' '),
        content_text: `${excerpt || ''} ${content || ''}`,
        schema_type: 'BlogPosting',
      });
      db.prepare(`
        INSERT OR IGNORE INTO seo_metadata (entity_type, entity_id, url_path, seo_title, meta_description, focus_keyword, schema_type, seo_score, analysis_json)
        VALUES ('blog', ?, ?, ?, ?, ?, 'BlogPosting', ?, ?)
      `).run(bid, urlPath, `${title.trim()} | آکادمی باریستاپرو`, (excerpt || title).slice(0, 155), title.trim().split(' ').slice(0, 2).join(' '), audit.score, JSON.stringify(audit));

      logActivity(req.user.id, 'create_blog_post', 'blog_post', bid, `انتشار مقاله: ${title.trim()}`);
      res.json({ ok: true, id: bid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/cms/blog/:id', requireAdmin, requirePermission('cms.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'مقاله یافت نشد.' });
      return;
    }
    const { title, slug, category_name, excerpt, content, cover_image, read_time_min, is_published } = req.body || {};
    db.prepare(`
      UPDATE blog_posts SET title = ?, slug = ?, category_name = ?, excerpt = ?, content = ?, cover_image = ?, read_time_min = ?, is_published = ? WHERE id = ?
    `).run(
      title?.trim() || existing.title,
      slug?.trim() || existing.slug,
      category_name?.trim() || existing.category_name,
      excerpt ?? existing.excerpt,
      content ?? existing.content,
      cover_image ?? existing.cover_image,
      read_time_min !== undefined ? Number(read_time_min) : existing.read_time_min,
      is_published !== undefined ? (is_published ? 1 : 0) : existing.is_published,
      id
    );
    logActivity(req.user.id, 'update_blog_post', 'blog_post', id, `ویرایش مقاله: ${title || existing.title}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/cms/blog/:id', requireAdmin, requirePermission('cms.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
    logActivity(req.user.id, 'delete_blog_post', 'blog_post', id, `حذف مقاله #${id}`);
    res.json({ ok: true });
  });

  app.post('/api/admin/cms/faqs', requireAdmin, requirePermission('cms.manage'), (req: AuthedRequest, res) => {
    const { question, answer, category, display_order } = req.body || {};
    if (!question?.trim() || !answer?.trim()) {
      res.status(400).json({ error: 'متن پرسش و پاسخ الزامی است.' });
      return;
    }
    const r = db.prepare('INSERT INTO faqs (question, answer, category, display_order) VALUES (?, ?, ?, ?)').run(
      question.trim(), answer.trim(), category?.trim() || 'عمومی', Number(display_order) || 0
    );
    logActivity(req.user.id, 'create_faq', 'faq', Number(r.lastInsertRowid), `افزودن سوال متداول`);
    res.json({ ok: true });
  });

  app.put('/api/admin/cms/faqs/:id', requireAdmin, requirePermission('cms.manage'), (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM faqs WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'مورد یافت نشد.' });
      return;
    }
    const { question, answer, category, display_order } = req.body || {};
    db.prepare('UPDATE faqs SET question = ?, answer = ?, category = ?, display_order = ? WHERE id = ?').run(
      question?.trim() || existing.question,
      answer?.trim() || existing.answer,
      category?.trim() || existing.category,
      display_order !== undefined ? Number(display_order) : existing.display_order,
      id
    );
    res.json({ ok: true });
  });

  app.delete('/api/admin/cms/faqs/:id', requireAdmin, requirePermission('cms.manage'), (req, res) => {
    db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.put('/api/admin/cms/homepage', requireAdmin, requirePermission('cms.manage'), (req: AuthedRequest, res) => {
    const { homepage_sections, hero } = req.body || {};
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    withTransaction(() => {
      if (Array.isArray(homepage_sections)) {
        upsert.run('homepage_sections', JSON.stringify(homepage_sections));
      }
      if (hero && typeof hero === 'object') {
        for (const k of ['hero_kicker', 'hero_title', 'hero_subtitle', 'hero_image', 'hero_cta_label']) {
          if (hero[k] !== undefined) upsert.run(k, String(hero[k]));
        }
      }
      logActivity(req.user.id, 'update_homepage_cms', 'settings', null, 'بروزرسانی بنر اصلی و بخش‌های صفحه نخست');
    });
    res.json({ ok: true });
  });

  // ========================
  // 9. STAFF, RBAC ROLES, NOTIFICATIONS, AUDIT LOGS & SYSTEM HEALTH
  // ========================
  app.get('/api/admin/users', requireAdmin, requirePermission('users.manage'), (_req, res) => {
    const users = db.prepare(`
      SELECT id, name, mobile, email, role, admin_role_key, status, cafe_name, created_at
      FROM users WHERE role IN ('admin','manager') ORDER BY id ASC
    `).all();
    res.json({ users });
  });

  app.post('/api/admin/users', requireAdmin, requirePermission('users.manage'), (req: AuthedRequest, res) => {
    try {
      const { name, mobile, email, password, admin_role_key } = req.body || {};
      if (!name?.trim() || !mobile?.trim() || !password || password.length < 6) {
        res.status(400).json({ error: 'نام، موبایل و رمز عبور حداقل ۶ کاراکتری الزامی است.' });
        return;
      }
      const roleKey = admin_role_key || 'store_manager';
      const systemRole = roleKey === 'super_admin' ? 'admin' : 'manager';
      const r = db.prepare(`
        INSERT INTO users (name, mobile, email, password_hash, role, admin_role_key, status, cafe_name)
        VALUES (?, ?, ?, ?, ?, ?, 'active', 'تیم مدیریت باریستاپرو')
      `).run(name.trim(), mobile.trim(), email?.trim() || null, hashPassword(password), systemRole, roleKey);
      logActivity(req.user.id, 'create_admin_user', 'user', Number(r.lastInsertRowid), `ایجاد کاربر مدیر جدید: ${name.trim()} (${roleKey})`);
      res.json({ ok: true, id: Number(r.lastInsertRowid) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/users/:id', requireAdmin, requirePermission('users.manage'), (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!target) {
      res.status(404).json({ error: 'کاربر یافت نشد.' });
      return;
    }
    if (target.id === req.user.id && req.body?.status === 'blocked') {
      res.status(400).json({ error: 'نمی‌توانید حساب کاربری فعال خودتان را مسدود کنید.' });
      return;
    }
    const { admin_role_key, status, name } = req.body || {};
    const nextRoleKey = admin_role_key ?? target.admin_role_key;
    const nextRole = nextRoleKey === 'super_admin' ? 'admin' : 'manager';
    db.prepare('UPDATE users SET name = ?, role = ?, admin_role_key = ?, status = ? WHERE id = ?').run(
      name?.trim() || target.name,
      nextRole,
      nextRoleKey,
      status === 'blocked' ? 'blocked' : 'active',
      id
    );
    logActivity(req.user.id, 'update_admin_user', 'user', id, `تغییر نقش/وضعیت مدیر #${id} به ${nextRoleKey}`);
    res.json({ ok: true });
  });

  app.get('/api/admin/roles', requireAdmin, requirePermission('users.manage'), (_req, res) => {
    const roles = db.prepare('SELECT * FROM admin_roles ORDER BY is_system DESC, role_key ASC').all() as any[];
    const perms = db.prepare('SELECT role_key, permission_key FROM role_permissions').all() as Array<{ role_key: string; permission_key: string }>;
    const enriched = roles.map((r) => ({
      ...r,
      permissions: perms.filter((p) => p.role_key === r.role_key).map((p) => p.permission_key),
    }));
    res.json({ roles: enriched, all_permissions: ALL_PERMISSIONS });
  });

  app.put('/api/admin/roles/:roleKey', requireAdmin, requirePermission('users.manage'), (req: AuthedRequest, res) => {
    const roleKey = req.params.roleKey;
    if (roleKey === 'super_admin') {
      res.status(400).json({ error: 'مجوزهای نقش مدیر کل سیستم غیرقابل کاهش است.' });
      return;
    }
    const permissions: string[] = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    const role = db.prepare('SELECT * FROM admin_roles WHERE role_key = ?').get(roleKey) as any;
    if (!role) {
      res.status(404).json({ error: 'نقش یافت نشد.' });
      return;
    }
    withTransaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_key = ?').run(roleKey);
      const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)');
      for (const p of permissions) {
        if ((ALL_PERMISSIONS as readonly string[]).includes(p)) {
          ins.run(roleKey, p);
        }
      }
      logActivity(req.user.id, 'update_role_permissions', 'role', null, `بروزرسانی ماتریس مجوزهای نقش ${role.title_fa} (${permissions.length} مجوز)`);
    });
    res.json({ ok: true });
  });

  app.get('/api/admin/notifications', requireAdmin, (req: AuthedRequest, res) => {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY id DESC LIMIT 30
    `).all(req.user.id);
    res.json({ notifications });
  });

  app.patch('/api/admin/notifications/read', requireAdmin, (req: AuthedRequest, res) => {
    const id = req.body?.id ? Number(req.body.id) : null;
    if (id) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id IS NULL OR user_id = ?').run(req.user.id);
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/audit-logs', requireAdmin, requirePermission('audit.view'), (req, res) => {
    const q = String(req.query.q || '').trim();
    const action = String(req.query.action || '').trim();
    let sql = `
      SELECT a.*, u.name as user_name, u.mobile as user_mobile
      FROM activity_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (q) {
      sql += ' AND (a.details LIKE ? OR a.action LIKE ? OR u.name LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }
    sql += ' ORDER BY a.id DESC LIMIT 150';
    res.json({ logs: db.prepare(sql).all(...params) });
  });

  app.get('/api/admin/system/health', requireAdmin, requirePermission('system.health'), (_req, res) => {
    const dbCheck = db.prepare('PRAGMA quick_check').get() as any;
    const dbSizePath = path.resolve(process.cwd(), 'data', 'baristapro.db');
    const dbSizeBytes = fs.existsSync(dbSizePath) ? fs.statSync(dbSizePath).size : 0;
    const mediaFiles = fs.existsSync(UPLOAD_MEDIA_DIR) ? fs.readdirSync(UPLOAD_MEDIA_DIR).length : 0;
    const uptimeSec = Math.floor(process.uptime());

    const counts = {
      products: (db.prepare('SELECT COUNT(*) as c FROM products').get() as any).c,
      variants: (db.prepare('SELECT COUNT(*) as c FROM product_variants').get() as any).c,
      orders: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
      users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
      media_assets: (db.prepare('SELECT COUNT(*) as c FROM media_assets').get() as any).c,
      navigation_items: (db.prepare('SELECT COUNT(*) as c FROM navigation_items').get() as any).c,
      seo_metadata: (db.prepare('SELECT COUNT(*) as c FROM seo_metadata').get() as any).c,
      activity_logs: (db.prepare('SELECT COUNT(*) as c FROM activity_logs').get() as any).c,
    };

    res.json({
      status: 'healthy',
      database: { status: dbCheck?.quick_check === 'ok' ? 'متصل و سالم (WAL)' : 'نیازمند بررسی', size_bytes: dbSizeBytes },
      runtime: { node_version: process.version, uptime_seconds: uptimeSec, memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024) },
      storage: { media_files_count: mediaFiles, media_dir_ready: fs.existsSync(UPLOAD_MEDIA_DIR) },
      counts,
    });
  });

  app.post('/api/admin/system/maintenance', requireAdmin, requirePermission('system.health'), (req: AuthedRequest, res) => {
    const action = String(req.body?.action || 'vacuum');
    if (action === 'cleanup_sessions') {
      const info = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
      logActivity(req.user.id, 'system_maintenance', 'system', null, `پاکسازی نشست‌های منقضی‌شده (${info.changes} رکورد)`);
      res.json({ ok: true, message: `${info.changes} نشست منقضی‌شده پاکسازی شد.` });
      return;
    }
    db.exec('PRAGMA optimize;');
    logActivity(req.user.id, 'system_maintenance', 'system', null, 'بهینه‌سازی ایندکس‌ها و کش دیتابیس انجام شد');
    res.json({ ok: true, message: 'کش کوئری‌ها و ایندکس‌های دیتابیس با موفقیت بهینه‌سازی شدند.' });
  });

  // Ensure unused import warning doesn't trigger if reviewBankTransferReceipt isn't called directly here
  void reviewBankTransferReceipt;
}
