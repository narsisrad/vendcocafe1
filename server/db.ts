import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const UPLOAD_RECEIPTS_DIR = path.resolve(process.cwd(), 'uploads', 'receipts');
if (!fs.existsSync(UPLOAD_RECEIPTS_DIR)) {
  fs.mkdirSync(UPLOAD_RECEIPTS_DIR, { recursive: true });
}

export const UPLOAD_MEDIA_DIR = path.resolve(process.cwd(), 'uploads', 'media');
if (!fs.existsSync(UPLOAD_MEDIA_DIR)) {
  fs.mkdirSync(UPLOAD_MEDIA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'baristapro.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('admin','manager','customer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked')),
      cafe_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receiver_mobile TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      full_address TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      description TEXT,
      image_key TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      country TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      brand_id INTEGER,
      manufacturer TEXT,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      main_image TEXT NOT NULL,
      gallery_images TEXT NOT NULL DEFAULT '[]',
      unit_type TEXT NOT NULL DEFAULT 'piece',
      unit_label_fa TEXT NOT NULL DEFAULT 'عدد',
      min_order_qty INTEGER NOT NULL DEFAULT 1,
      order_step_qty INTEGER NOT NULL DEFAULT 1,
      max_order_qty INTEGER,
      weight_grams INTEGER NOT NULL DEFAULT 500,
      specifications TEXT NOT NULL DEFAULT '{}',
      complementary_ids TEXT NOT NULL DEFAULT '[]',
      is_published INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      is_new INTEGER NOT NULL DEFAULT 0,
      sales_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      variant_title TEXT NOT NULL,
      attributes TEXT NOT NULL DEFAULT '{}',
      regular_price INTEGER NOT NULL,
      discount_price INTEGER,
      cost_price INTEGER,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in','out','reserve','release','adjustment')),
      quantity_delta INTEGER NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      note TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      guest_token TEXT UNIQUE,
      coupon_code TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(cart_id, variant_id),
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipping_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      calc_type TEXT NOT NULL DEFAULT 'fixed' CHECK(calc_type IN ('fixed','weight_based','free_above')),
      base_cost INTEGER NOT NULL DEFAULT 0,
      per_kg_cost INTEGER NOT NULL DEFAULT 0,
      free_threshold INTEGER,
      estimated_days TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed')),
      discount_value INTEGER NOT NULL,
      min_order_amount INTEGER NOT NULL DEFAULT 0,
      max_discount_amount INTEGER,
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      guest_token TEXT,
      customer_name TEXT NOT NULL,
      customer_mobile TEXT NOT NULL,
      customer_email TEXT,
      shipping_address_snapshot TEXT NOT NULL,
      shipping_method_id INTEGER NOT NULL,
      shipping_method_title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      subtotal_amount INTEGER NOT NULL,
      product_discount_amount INTEGER NOT NULL DEFAULT 0,
      coupon_code TEXT,
      coupon_discount_amount INTEGER NOT NULL DEFAULT 0,
      shipping_fee INTEGER NOT NULL DEFAULT 0,
      total_payable INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('online_gateway','bank_transfer')),
      tracking_code TEXT,
      admin_notes TEXT,
      expires_at TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      product_title TEXT NOT NULL,
      variant_title TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_label TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      regular_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_status_histories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      note TEXT,
      changed_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('online_gateway','bank_transfer')),
      gateway_name TEXT,
      authority_token TEXT UNIQUE,
      idempotency_key TEXT UNIQUE,
      reference_id TEXT,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','failed')),
      receipt_filename TEXT,
      card_last4 TEXT,
      rejection_reason TEXT,
      verified_by INTEGER,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      is_approved INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_name TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      read_time_min INTEGER NOT NULL DEFAULT 5,
      is_published INTEGER NOT NULL DEFAULT 1,
      published_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'عمومی',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS seo_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL DEFAULT 0,
      url_path TEXT NOT NULL UNIQUE,
      seo_title TEXT NOT NULL,
      meta_description TEXT NOT NULL,
      focus_keyword TEXT NOT NULL DEFAULT '',
      secondary_keywords TEXT NOT NULL DEFAULT '',
      canonical_url TEXT,
      robots_index INTEGER NOT NULL DEFAULT 1,
      robots_follow INTEGER NOT NULL DEFAULT 1,
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      schema_type TEXT NOT NULL DEFAULT 'WebPage',
      custom_json_ld TEXT,
      seo_score INTEGER NOT NULL DEFAULT 0,
      analysis_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seo_redirects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL UNIQUE,
      target_path TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 301 CHECK(status_code IN (301, 302)),
      hits INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      channel TEXT NOT NULL DEFAULT 'in_app',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      folder TEXT NOT NULL DEFAULT 'products',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS navigation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL DEFAULT 'both' CHECK(location IN ('header','mobile_drawer','footer','both')),
      label TEXT NOT NULL,
      link_type TEXT NOT NULL DEFAULT 'custom' CHECK(link_type IN ('product','category','blog','page','custom')),
      target_slug TEXT NOT NULL DEFAULT '',
      target_url TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      open_in_new_tab INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_roles (
      role_key TEXT PRIMARY KEY,
      title_fa TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_key TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      UNIQUE(role_key, permission_key)
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
    CREATE INDEX IF NOT EXISTS idx_products_published ON products(is_published);
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_seo_url ON seo_metadata(url_path);
    CREATE INDEX IF NOT EXISTS idx_media_folder ON media_assets(folder);
    CREATE INDEX IF NOT EXISTS idx_nav_location ON navigation_items(location, is_active, display_order);
    CREATE INDEX IF NOT EXISTS idx_inv_var ON inventory_movements(variant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
  `);

  // Additive non-destructive column migrations for existing databases
  ensureColumn('users', 'customer_group', "TEXT NOT NULL DEFAULT 'regular'");
  ensureColumn('users', 'wholesale_status', "TEXT NOT NULL DEFAULT 'none'");
  ensureColumn('users', 'business_id', 'TEXT');
  ensureColumn('users', 'credit_limit', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'payment_terms', 'TEXT');
  ensureColumn('users', 'internal_notes', 'TEXT');
  ensureColumn('users', 'admin_role_key', 'TEXT');

  ensureColumn('products', 'main_image_alt', 'TEXT');
  ensureColumn('products', 'tags', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('products', 'shipping_class', "TEXT NOT NULL DEFAULT 'standard'");
  ensureColumn('products', 'is_fragile', 'INTEGER NOT NULL DEFAULT 0');

  ensureColumn('product_variants', 'wholesale_price', 'INTEGER');
  ensureColumn('product_variants', 'min_stock_alert', 'INTEGER NOT NULL DEFAULT 10');
  ensureColumn('product_variants', 'warehouse_location', "TEXT NOT NULL DEFAULT 'انبار مرکزی تهران'");

  ensureColumn('categories', 'seo_title', 'TEXT');
  ensureColumn('categories', 'meta_description', 'TEXT');

  ensureColumn('brands', 'logo_url', 'TEXT');
  ensureColumn('brands', 'website', 'TEXT');

  ensureColumn('orders', 'refunded_amount', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('orders', 'cancel_reason', 'TEXT');
  ensureColumn('orders', 'stock_restored', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('orders', 'customer_note', 'TEXT');

  ensureColumn('inventory_movements', 'previous_quantity', 'INTEGER');
  ensureColumn('inventory_movements', 'new_quantity', 'INTEGER');

  ensureColumn('coupons', 'customer_group', 'TEXT');
  ensureColumn('coupons', 'first_order_only', 'INTEGER NOT NULL DEFAULT 0');
}

export function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
