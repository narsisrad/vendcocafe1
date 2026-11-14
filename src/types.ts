export interface User {
  id: number;
  name: string;
  mobile: string;
  email?: string;
  role: 'admin' | 'manager' | 'customer';
  cafe_name?: string;
  admin_role_key?: string;
  customer_group?: 'regular' | 'wholesale' | 'vip';
  wholesale_status?: 'none' | 'pending' | 'approved' | 'rejected';
  permissions?: string[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description?: string;
  image_key?: string;
  display_order?: number;
  is_active?: number;
  seo_title?: string;
  meta_description?: string;
  product_count?: number;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  country?: string;
  description?: string;
  logo_url?: string;
  website?: string;
  is_active?: number;
  product_count?: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  barcode?: string;
  variant_title: string;
  attributes: Record<string, string>;
  regular_price: number;
  discount_price: number | null;
  wholesale_price?: number | null;
  cost_price?: number | null;
  stock_quantity: number;
  reserved_quantity: number;
  available_stock: number;
  min_stock_alert?: number;
  warehouse_location?: string;
  is_active: number;
}

export interface Product {
  id: number;
  title: string;
  slug: string;
  sku: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  brand_id?: number;
  brand_name?: string;
  brand_slug?: string;
  brand_country?: string;
  manufacturer?: string;
  short_description: string;
  description: string;
  main_image: string;
  main_image_alt?: string;
  gallery_images: string[];
  unit_type: string;
  unit_label_fa: string;
  min_order_qty: number;
  order_step_qty: number;
  max_order_qty: number | null;
  weight_grams: number;
  specifications: Record<string, string>;
  complementary_ids?: number[];
  tags?: string[];
  shipping_class?: string;
  is_fragile?: number;
  is_published?: number;
  is_featured: number;
  is_bestseller: number;
  is_new: number;
  sales_count: number;
  seo_score?: number;
  total_available_stock?: number;
  variants?: ProductVariant[];
  default_variant_id?: number;
  regular_price?: number;
  discount_price?: number | null;
  wholesale_price?: number | null;
  effective_price?: number;
  is_wholesale_price?: boolean;
  discount_percent?: number;
  available_stock?: number;
  variant_count?: number;
}

export interface NavigationItem {
  id: number;
  location: 'header' | 'mobile_drawer' | 'footer' | 'both';
  label: string;
  link_type: 'product' | 'category' | 'blog' | 'page' | 'custom';
  target_slug: string;
  target_url: string;
  display_order: number;
  is_active: number;
  open_in_new_tab: number;
}

export interface MediaAsset {
  id: number | string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  alt_text: string;
  caption?: string;
  folder: string;
  source?: 'uploaded' | 'builtin';
  usage?: Array<{ type: string; id: number; title: string }>;
  created_at?: string;
}

export interface CartItem {
  item_id: number;
  product_id: number;
  variant_id: number;
  product_title: string;
  product_slug: string;
  main_image: string;
  unit_label_fa: string;
  variant_title: string;
  sku: string;
  quantity: number;
  min_order_qty: number;
  order_step_qty: number;
  max_order_qty: number | null;
  regular_price: number;
  unit_price: number;
  wholesale_price?: number | null;
  is_wholesale_applied?: boolean;
  line_total: number;
  line_discount: number;
  available_stock: number;
  is_available: boolean;
  is_low_stock: boolean;
}

export interface CartSummary {
  cart_id: number;
  items: CartItem[];
  total_quantity: number;
  subtotal_regular: number;
  product_discount_amount: number;
  after_product_discount: number;
  coupon_code: string | null;
  coupon_discount_amount: number;
  coupon_error?: string | null;
  shipping_fee: number;
  shipping_method?: ShippingMethod | null;
  total_payable: number;
  total_weight_grams: number;
  free_shipping_threshold: number;
  free_shipping_remaining: number;
  free_shipping_percent: number;
  has_unavailable_items: boolean;
  complementary_products: Product[];
}

export interface ShippingMethod {
  id: number;
  title: string;
  description: string;
  calc_type: 'fixed' | 'weight_based' | 'free_above';
  base_cost: number;
  per_kg_cost: number;
  free_threshold: number | null;
  estimated_days: string;
}

export interface Address {
  id: number;
  title: string;
  receiver_name: string;
  receiver_mobile: string;
  province: string;
  city: string;
  postal_code: string;
  full_address: string;
  is_default: number;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  category_name: string;
  excerpt: string;
  content: string;
  cover_image: string;
  read_time_min: number;
  published_at: string;
}

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'good' | 'warning' | 'error';
  message: string;
  points: number;
  maxPoints: number;
}

export interface SeoPageRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  url_path: string;
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
  secondary_keywords: string;
  canonical_url: string;
  robots_index: number;
  robots_follow: number;
  og_title: string;
  og_description: string;
  schema_type: string;
  custom_json_ld: string | null;
  seo_score: number;
  analysis: { score: number; checks: SeoCheck[] };
  updated_at: string;
}
