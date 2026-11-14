import crypto from 'node:crypto';
import { db } from './db.ts';
import { analyzeSeoContent } from './seoEngine.ts';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derived);
}

export function seedDatabaseIfEmpty() {
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount > 0) {
    seedUpgradesIfEmpty();
    return;
  }

  // 1. Seed Users (Admin + Sample Customer)
  const insertUser = db.prepare(`
    INSERT INTO users (name, mobile, email, password_hash, role, status, cafe_name)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `);
  const adminRes = insertUser.run('آرش کیانی (مدیر کل)', '09120000001', 'admin@baristapro.ir', hashPassword('Admin@1405'), 'admin', 'دفتر مرکزی باریستاپرو');
  const custRes = insertUser.run('سارا محمدی', '09121112233', 'sara@roastcafe.ir', hashPassword('Cafe@1405'), 'customer', 'کافه رُست تهران');

  db.prepare(`
    INSERT INTO addresses (user_id, title, receiver_name, receiver_mobile, province, city, postal_code, full_address, is_default)
    VALUES (?, 'شعبه مرکزی کافه', 'سارا محمدی', '09121112233', 'تهران', 'تهران', '1587743111', 'خیابان کریم‌خان زند، نبش خیابان خردمند شمالی، پلاک ۴۲، کافه رست', 1)
  `).run(custRes.lastInsertRowid);

  // 2. Seed Settings
  const settingsData: Record<string, string> = {
    store_name: 'باریستاپرو | سامانه تخصصی ملزومات کافی‌شاپ',
    store_phone: '۰۲۱-۸۸۴۵۹۲۱۰',
    store_email: 'sales@baristapro.ir',
    store_address: 'تهران، خیابان سهروردی شمالی، پلاک ۱۸۴، ساختمان تجهیزات باریستا',
    free_shipping_threshold: '5000000',
    bank_name: 'بانک سامان',
    bank_account_holder: 'شرکت بازرگانی قهوه و ملزومات باریستاپرو',
    bank_card_number: '6219-8619-4421-8890',
    bank_iban: 'IR840560081580002491234001',
    bank_instructions: 'لطفاً مبلغ دقیق فاکتور را به شماره کارت یا شبای فوق واریز کرده و تصویر فیش واریزی همراه با شماره پیگیری ۴ رقمی را بارگذاری نمایید.',
    ga4_measurement_id: '',
    gtm_container_id: '',
    robots_txt: "User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\nDisallow: /panel\nDisallow: /admin\nDisallow: /api/\nSitemap: /sitemap.xml",
    homepage_sections: JSON.stringify([
      { key: 'hero', title: 'بنر اصلی تامین ملزومات', visible: true, order: 1 },
      { key: 'categories', title: 'دسته‌بندی‌های تخصصی کافه', visible: true, order: 2 },
      { key: 'bestsellers', title: 'پرفروش‌ترین ملزومات کافی‌شاپ', visible: true, order: 3 },
      { key: 'offers', title: 'پیشنهادهای ویژه خرید عمده', visible: true, order: 4 },
      { key: 'blog', title: 'آکادمی و راهنمای باریستا', visible: true, order: 5 },
    ]),
  };
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(settingsData)) {
    insertSetting.run(k, v);
  }

  // 3. Seed Categories
  const insertCat = db.prepare(`
    INSERT INTO categories (name, slug, parent_id, description, image_key, display_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const cBeans = insertCat.run('دان قهوه و اسپرسو', 'coffee-beans', null, 'دان قهوه اسپرسو تجاری و تخصصی تک‌خاستگاه با رُست تازه روزانه برای کافه‌ها', 'prod_arabica_beans', 1).lastInsertRowid;
  const cCups = insertCat.run('لیوان کاغذی و درب بیرون‌بر', 'disposable-cups', null, 'لیوان‌های دوجداره کرافت و درب‌های پی‌پی با فروش در گام‌های ۵۰ عددی و کارتن', 'prod_paper_cups', 2).lastInsertRowid;
  const cSyrups = insertCat.run('سیروپ و طعم‌دهنده‌ها', 'coffee-syrups', null, 'سیروپ‌های تخصصی کارامل، وانیل و فندق همراه با پمپ اندازه‌گیر دقیق', 'prod_coffee_syrup', 3).lastInsertRowid;
  const cTools = insertCat.run('ابزار باریستا و عصاره‌گیری', 'barista-tools', null, 'تمپر کالیبره، پیچر استیل، رینگ دوزینگ و تجهیزات بار گرم', 'prod_barista_tools', 4).lastInsertRowid;
  const cClean = insertCat.run('شوینده دستگاه اسپرسو', 'machine-cleaners', null, 'پودر بک‌فلاش، رسوب‌زدا و برس گروه هد دستگاه‌های صنعتی', 'prod_machine_cleaner', 5).lastInsertRowid;
  const cPowder = insertCat.run('پودر شکلات و کاکائو', 'cocoa-powders', null, 'پودر کاکائو هلندی، هات‌چاکلت کلاسیک و ماسالای ویژه کافه‌داران', 'prod_cocoa_powder', 6).lastInsertRowid;
  const cFilter = insertCat.run('فیلتر قهوه دمی و کاغذی', 'coffee-filters', null, 'فیلتر کاغذی V60 و کمکس بدون کلر با تراکم الیاف استاندارد', 'prod_v60_filters', 7).lastInsertRowid;

  // 4. Seed Brands
  const insertBrand = db.prepare('INSERT INTO brands (name, slug, country, description) VALUES (?, ?, ?, ?)');
  const bArtisan = insertBrand.run('آرتیسان روسترز (Artisan)', 'artisan-roasters', 'ایران / ایتالیا', 'برشته‌کاری تخصصی دان اسپرسو و تک‌خاستگاه کافه‌ای').lastInsertRowid;
  const bMonin = insertBrand.run('مونین (Monin)', 'monin', 'فرانسه', 'تولیدکننده برتر سیروپ‌ها و پوره‌های بار سرد و گرم').lastInsertRowid;
  const bOrigin = insertBrand.run('اوریجین تولز (Origin)', 'origin-tools', 'آلمان', 'ابزار مهندسی‌شده باریستا از استیل ۳۰۴ و چوب گردو').lastInsertRowid;
  const bPack = insertBrand.run('پک‌پرو (PackPro)', 'packpro', 'ایران', 'تولیدکننده لیوان‌های دوجداره و بسته‌بندی بهداشتی بیرون‌بر').lastInsertRowid;
  const bUrnex = insertBrand.run('یورنکس / باریستاپرو', 'baristapro-care', 'آمریکا / ایران', 'فرمولاسیون تخصصی نگهداری و شستشوی ماشین‌های اسپرسو').lastInsertRowid;
  const bHario = insertBrand.run('هاریو (Hario)', 'hario', 'ژاپن', 'مرجع تجهیزات دمی V60 و فیلترهای کاغذی').lastInsertRowid;

  // 5. Seed Products & Variants
  const insertProd = db.prepare(`
    INSERT INTO products (
      title, slug, sku, category_id, brand_id, manufacturer, short_description, description,
      main_image, gallery_images, unit_type, unit_label_fa, min_order_qty, order_step_qty, max_order_qty,
      weight_grams, specifications, complementary_ids, is_published, is_featured, is_bestseller, is_new, sales_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `);

  const insertVar = db.prepare(`
    INSERT INTO product_variants (product_id, sku, barcode, variant_title, attributes, regular_price, discount_price, cost_price, stock_quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Product 1: Espresso Arabica Blend
  const p1 = insertProd.run(
    'دان قهوه اسپرسو سوماترا ۱۰۰٪ عربیکا آرتیسان',
    'sumatra-arabica-espresso-beans',
    'BP-BEAN-101',
    cBeans, bArtisan, 'رستری آرتیسان',
    'رست مدیوم-دارک متعادل با نت‌های شکلات تلخ، کارامل و ادویه؛ مناسب عصاره‌گیری با دستگاه اسپرسو صنعتی.',
    'دان قهوه سوماترا مندلینگ از مزارع مرتفع اندونزی با فرآوری نیمه‌شسته تهیه شده و جهت پایداری کرما در دستگاه‌های دو و سه گروپ کافی‌شاپی برشته‌کاری می‌گردد. پاکت مجهز به سوپاپ یک‌طرفه تخلیه گاز CO2 است.',
    'prod_arabica_beans', JSON.stringify(['prod_arabica_beans', 'hero_coffee_roastery']),
    'kg', 'کیلوگرم / بسته', 1, 1, 50, 1000,
    JSON.stringify({ 'درجه رست': 'مدیوم رو به دارک', 'ترکیب': '۱۰۰٪ عربیکا تخصصی', 'نت طعمی': 'کاکائو، فندق، کارامل', 'ارتفاع کشت': '۱۵۰۰ متر', 'نوع بسته‌بندی': 'پاکت سوپاپ‌دار سه‌لایه' }),
    JSON.stringify([3, 5]), 1, 1, 0, 148
  ).lastInsertRowid;
  insertVar.run(p1, 'BP-BEAN-101-1KG', '626000101001', 'بسته ۱ کیلوگرمی - دان کامل', JSON.stringify({ weight: '۱ کیلوگرم', grind: 'دان کامل' }), 1480000, 1320000, 980000, 45);
  insertVar.run(p1, 'BP-BEAN-101-250G', '626000101002', 'بسته ۲۵۰ گرمی - دان کامل', JSON.stringify({ weight: '۲۵۰ گرم', grind: 'دان کامل' }), 420000, 385000, 270000, 80);
  insertVar.run(p1, 'BP-BEAN-101-ESP', '626000101003', 'بسته ۱ کیلوگرمی - آسیاب اسپرسو صنعتی', JSON.stringify({ weight: '۱ کیلوگرم', grind: 'آسیاب اسپرسو' }), 1500000, 1340000, 990000, 18);

  // Product 2: Double-Wall Paper Cups (Minimum 50, step 50!)
  const p2 = insertProd.run(
    'لیوان کاغذی دوجداره بیرون‌بر کرافت به همراه درب مات',
    'double-wall-kraft-paper-cup-50pack',
    'BP-CUP-201',
    cCups, bPack, 'پک‌پرو ایران',
    'لیوان کاغذی دوجداره عایق حرارت بدون نیاز به هولدر؛ فروش در مضرب‌های ۵۰ عددی ویژه کافه‌های بیرون‌بر.',
    'ساخته شده از مقوای بهداشتی فودگرید ۳۰۰+۲۵۰ گرم با روکش داخلی مقاوم در برابر نشت حرارت بالای ۹۵ درجه سانتی‌گراد. همراه با درب پی‌پی نشکن قفل‌دار.',
    'prod_paper_cups', JSON.stringify(['prod_paper_cups']),
    'piece', 'عدد', 50, 50, 5000, 18,
    JSON.stringify({ 'ساختار': 'دوجداره عایق حرارت', 'گام سفارش': 'مضرب ۵۰ عددی', 'جنس مقوا': 'کرافت ۳۰۰ گرم فودگرید', 'مناسب برای': 'لته، کاپوچینو، آمریکانو' }),
    JSON.stringify([1, 4]), 1, 1, 1, 310
  ).lastInsertRowid;
  insertVar.run(p2, 'BP-CUP-201-8OZ', '626000201008', 'سایز ۸ اونس (۲۲۰ سی‌سی) + درب مشکی', JSON.stringify({ size: '۸ اونس', color: 'کرافت' }), 4200, 3800, 2600, 4500);
  insertVar.run(p2, 'BP-CUP-201-12OZ', '626000201012', 'سایز ۱۲ اونس (۳۶۰ سی‌سی) + درب مشکی', JSON.stringify({ size: '۱۲ اونس', color: 'کرافت' }), 5100, 4650, 3200, 3200);

  // Product 3: Salted Caramel Coffee Syrup
  const p3 = insertProd.run(
    'سیروپ تخصصی کارامل نمکی به همراه پمپ مسی کالیبره',
    'salted-caramel-coffee-syrup-750ml',
    'BP-SYR-301',
    cSyrups, bMonin, 'مونین فرانسه',
    'طعم غنی کارامل کره‌ای با تعادل نمک دریایی؛ ایده‌آل برای لته کارامل، فراپه و آیس آمریکانو.',
    'سیروپ کارامل نمکی تهیه‌شده با شکر نیشکر خالص و عصاره کارامل طبیعی، بدون ته‌نشینی در شیر سرد یا گرم. هر پمپ دقیقاً ۷.۵ میلی‌لیتر دوز استاندارد آزاد می‌کند.',
    'prod_coffee_syrup', JSON.stringify(['prod_coffee_syrup']),
    'bottle', 'بطری', 1, 1, 48, 1150,
    JSON.stringify({ 'حجم خالص': '۷۵۰ میلی‌لیتر', 'مقدار در هر پمپ': '۷.۵ سی‌سی', 'ماندگاری پس از باز شدن': '۶ ماه در دمای محیط', 'جنس بطری': 'شیشه ضخیم شفاف' }),
    JSON.stringify([1, 6]), 1, 1, 1, 96
  ).lastInsertRowid;
  insertVar.run(p3, 'BP-SYR-301-CARAMEL', '626000301001', 'طعم کارامل نمکی (۷۵۰ میلی‌لیتر + پمپ)', JSON.stringify({ flavor: 'کارامل نمکی', volume: '750ml' }), 890000, 795000, 590000, 62);
  insertVar.run(p3, 'BP-SYR-301-VANILLA', '626000301002', 'طعم وانیل ماداگاسکار (۷۵۰ میلی‌لیتر + پمپ)', JSON.stringify({ flavor: 'وانیل', volume: '750ml' }), 870000, null, 580000, 34);

  // Product 4: Barista Precision Tools Kit
  const p4 = insertProd.run(
    'ست حرفه‌ای تمپر استیل ۵۸.۵ میل دسته گردو و پیچر ۶۰۰ میل',
    'barista-tamper-pitcher-pro-kit',
    'BP-TOOL-401',
    cTools, bOrigin, 'اوریجین تولز',
    'کف صاف ماشین‌کاری CNC استیل ۳۰۴ ضدزنگ با قطر دقیق ۵۸.۵ میلی‌متر جهت حذف کامل چنلینگ.',
    'طراحی ارگونومیک دسته از چوب گردوی طبیعی فرآوری‌شده به همراه پیچر ۶۰۰ میلی‌لیتری با دهانه تیز مخصوص لته آرت حرفه‌ای و رینگ دوزینگ مگنتی آلومینیومی.',
    'prod_barista_tools', JSON.stringify(['prod_barista_tools', 'hero_coffee_roastery']),
    'set', 'ست کامل', 1, 1, 20, 950,
    JSON.stringify({ 'قطر کف تمپر': '۵۸.۵ میلی‌متر', 'جنس بدنه': 'فولاد ضدزنگ ۳۰۴', 'ظرفیت پیچر': '۶۰۰ میلی‌لیتر', 'مگنت رینگ': '۸ نقطه نئودیمیوم' }),
    JSON.stringify([5, 1]), 1, 1, 0, 54
  ).lastInsertRowid;
  insertVar.run(p4, 'BP-TOOL-401-SET', '626000401001', 'ست کامل ۳ تکه (تمپر + پیچر + رینگ دوزینگ)', JSON.stringify({ diameter: '58.5mm', pieces: '3 تکه' }), 3650000, 3290000, 2400000, 14);
  insertVar.run(p4, 'BP-TOOL-401-TAMPER', '626000401002', 'تمپر تکی ۵۸.۵ میلی‌متر دسته گردو', JSON.stringify({ diameter: '58.5mm', pieces: 'تکی' }), 1850000, 1690000, 1200000, 29);

  // Product 5: Espresso Machine Backflush Powder + Brush
  const p5 = insertProd.run(
    'پودر شستشو و جرم‌گیر گروپ هد اسپرسوساز صنعتی ۷۵۰ گرم + برس چوبی',
    'espresso-machine-backflush-cleaner-750g',
    'BP-CLN-501',
    cClean, bUrnex, 'باریستاپرو کر',
    'پاک‌کننده سریع چربی‌ها و رسوبات قهوه از توری دوش، سبد پرتافیلتر و شیر برقی گروپ هد.',
    'فرمولاسیون بدون بو و ایمن برای قطعات برنجی و استیل ماشین‌های اسپرسوساز صنعتی لامارزوکو، سیمونلی، سن‌رمو و ویکتوریا آردوینو. دارای تاییدیه بهداشتی مصرف غذایی.',
    'prod_machine_cleaner', JSON.stringify(['prod_machine_cleaner']),
    'pack', 'قوطی + برس', 1, 1, 100, 820,
    JSON.stringify({ 'وزن خالص': '۷۵۰ گرم', 'تعداد دفعات شستشو': 'حدود ۱۵۰ مرتبه بک‌فلاش', 'اقلام همراه': 'برس چوبی موی طبیعی', 'سازگاری': 'تمام برندهای صنعتی' }),
    JSON.stringify([4, 1]), 1, 0, 1, 122
  ).lastInsertRowid;
  insertVar.run(p5, 'BP-CLN-501-750', '626000501001', 'قوطی ۷۵۰ گرم به همراه برس گروپ‌هد', JSON.stringify({ weight: '۷۵۰ گرم' }), 740000, 680000, 440000, 75);

  // Product 6: Dutch-Process Specialty Cocoa Powder
  const p6 = insertProd.run(
    'پودر کاکائو هلندی دارک مخصوص هات‌چاکلت و موکای کافه‌ای',
    'dutch-process-dark-cocoa-powder',
    'BP-COC-601',
    cPowder, bArtisan, 'هارلم هلند',
    'پودر کاکائوی ۲۲-۲۴٪ چربی طبیعی با بافت مخملی، رنگ تیره و انحلال فوری در شیر بخارزده.',
    'تهیه‌شده از دانه‌های کاکائوی غرب آفریقا با فرآیند آلکالیزه هلندی جهت کاهش اسیدیته و ایجاد طعم عمیق شکلات تلخ در نوشیدنی‌های گرم و دسرهای ویترینی کافی‌شاپ.',
    'prod_cocoa_powder', JSON.stringify(['prod_cocoa_powder']),
    'pack', 'قوطی / بسته', 1, 1, 60, 1000,
    JSON.stringify({ 'درصد کره کاکائو': '۲۲ تا ۲۴ درصد', 'فرآیند': 'Dutch-Processed', 'کاربرد': 'موکا، هات چاکلت، تیرامیسو' }),
    JSON.stringify([3, 2]), 1, 0, 1, 88
  ).lastInsertRowid;
  insertVar.run(p6, 'BP-COC-601-250', '626000601001', 'قوطی فلزی ۲۵۰ گرمی ویژه بار', JSON.stringify({ weight: '۲۵۰ گرم' }), 590000, 540000, 390000, 40);
  insertVar.run(p6, 'BP-COC-601-1KG', '626000601002', 'بسته اقتصادی ۱ کیلوگرمی کافه‌دار', JSON.stringify({ weight: '۱ کیلوگرم' }), 1950000, 1780000, 1300000, 22);

  // Product 7: V60 Unbleached Paper Filters (Min 2, Step 1)
  const p7 = insertProd.run(
    'فیلتر کاغذی قهوه دمی V60 بدون سفیدکننده (بسته ۱۰۰ عددی)',
    'v60-unbleached-paper-filters-100pack',
    'BP-FLT-701',
    cFilter, bHario, 'هاریو ژاپن',
    'کاغذ فیلتر مخروطی ۰۲ ساخت ژاپن بدون مواد شیمیایی سفیدکننده؛ حفظ شفافیت طعمی قهوه دمی.',
    'تراکم دقیق الیاف کاغذ ژاپنی مانع از عبور ذرات ریز (Fines) شده و عصاره‌گیری یکنواخت با زمان عبور استاندارد ۲:۳۰ دقیقه را برای باریستاهای بار دمی تضمین می‌کند.',
    'prod_v60_filters', JSON.stringify(['prod_v60_filters']),
    'pack', 'بسته ۱۰۰ عددی', 1, 1, 100, 160,
    JSON.stringify({ 'سایز': '۰۲ (۱ تا ۴ کاپ)', 'تعداد در بسته': '۱۰۰ برگ', 'رنگ کاغذ': 'طبیعی بدون کلر (قهوه‌ای)' }),
    JSON.stringify([1, 4]), 1, 1, 0, 175
  ).lastInsertRowid;
  insertVar.run(p7, 'BP-FLT-701-02', '626000701002', 'سایز ۰۲ - بسته ۱۰۰ عددی', JSON.stringify({ size: '02' }), 340000, 295000, 195000, 120);
  insertVar.run(p7, 'BP-FLT-701-01', '626000701001', 'سایز ۰۱ - بسته ۱۰۰ عددی', JSON.stringify({ size: '01' }), 310000, null, 180000, 4); // Low stock demo!

  // 6. Shipping Methods
  const insertShip = db.prepare(`
    INSERT INTO shipping_methods (title, description, calc_type, base_cost, per_kg_cost, free_threshold, estimated_days)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertShip.run('پیک اختصاصی شهر تهران (ارسال فوری کافه‌ها)', 'تحویل زیر ۳ ساعت در محدوده مناطق ۲۲گانه تهران ویژه سفارشات فوری بار', 'free_above', 145000, 0, 5000000, 'همان روز (۲ تا ۴ ساعت)');
  insertShip.run('تیپاکس و پست پیشتاز سراسر کشور (محاسبه وزنی)', 'بسته‌بندی ایمن کارتن چندلایه با ارسال به تمام شهرستان‌ها', 'weight_based', 120000, 35000, 8000000, '۲ تا ۳ روز کاری');
  insertShip.run('باربری عمده و پالتی (ویژه کارتن لیوان و کیسه قهوه)', 'ارسال مقرون‌به‌صرفه برای سفارش‌های حجیم کافی‌شاپ‌ها و روسترها', 'fixed', 250000, 0, null, '۱ تا ۲ روز کاری');
  insertShip.run('تحویل حضوری از انبار مرکزی سهروردی', 'دریافت مستقیم سفارش بدون هزینه حمل پس از تایید آماده به تحویل', 'fixed', 0, 0, null, 'آماده تحویل طی ۱ ساعت');

  // 7. Coupons
  db.prepare(`
    INSERT INTO coupons (code, title, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit)
    VALUES
      ('CAFE10', 'تخفیف ۱۰ درصدی تامین ملزومات کافه‌داران', 'percent', 10, 1000000, 800000, 200),
      ('WELCOME200', 'بن تخفیف ۲۰۰ هزار تومانی اولین سفارش', 'fixed', 200000, 1500000, 200000, 500)
  `).run();

  // 8. Blog Posts
  const insertBlog = db.prepare(`
    INSERT INTO blog_posts (title, slug, category_name, excerpt, content, cover_image, read_time_min)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertBlog.run(
    'راهنمای تنظیم آسیاب و جلوگیری از چنلینگ در بار اسپرسو شلوغ',
    'dial-in-espresso-grinder-guide',
    'آموزش باریستا',
    'چگونه در ساعات اوج شلوغی کافه با انتخاب تمپر ۵۸.۵ میلی‌متری و توزیع یکنواخت سبد پرتافیلتر، شات اسپرسویی بدون تلخی بسازیم.',
    'عصاره‌گیری پایدار در یک کافی‌شاپ تجاری نیازمند کنترل دقیق سه متغیر است: وزن دوز ورودی، یکنواختی سطح سابه قهوه پیش از تمپ و دمای پایدار گروپ هد. استفاده از ابزارهای دقیق نظیر رینگ دوزینگ و تمپر کالیبره ۵۸.۵ میلی‌متری باعث می‌شود شکاف کنار دیواره بسکت حذف شده و آب با فشار ۹ بار به‌صورت همگن از تمام کیک قهوه عبور کند.\n\nهمچنین شستشوی روزانه توری دوش با پودر بک‌فلاش پس از پایان شیفت کاری، مانع از ایجاد طعم کهنه و سوخته در شات‌های صبح روز بعد خواهد شد.',
    'prod_barista_tools',
    6
  );
  insertBlog.run(
    'انتخاب بهترین لیوان بیرون‌بر دوجداره و تاثیر آن بر رضایت مشتری',
    'choosing-best-takeaway-coffee-cups',
    'مدیریت کافی‌شاپ',
    'مقایسه فنی گرماژ مقوای کرافت فودگرید، دوام حرارتی و استاندارد درب‌های قفل‌دار برای سرویس‌دهی مطمئن بیرون‌بر.',
    'بسیاری از کافه‌ها هزینه زیادی صرف خرید دان قهوه تخصصی می‌کنند، اما استفاده از لیوان کاغذی نامرغوب با بوی چسب یا نشت درب هنگام حمل با پیک، تجربه مشتری را تخریب می‌کند. لیوان‌های دوجداره با مقوای ۳۰۰ گرم و روکش داخلی ایمن، دمای نوشیدنی را تا ۳۵ دقیقه حفظ کرده و بدون نیاز به هولدر مقوایی اضافه، حس کیفیت برند کافه شما را منتقل می‌کنند.',
    'prod_paper_cups',
    4
  );

  // 9. FAQs
  const insertFaq = db.prepare('INSERT INTO faqs (question, answer, category, display_order) VALUES (?, ?, ?, ?)');
  insertFaq.run('آیا امکان خرید عمده لیوان و دان قهوه با فاکتور رسمی وجود دارد؟', 'بله، تمامی کالاهای موجود در باریستاپرو دارای قابلیت سفارش در تیراژ کارتن و کیلوگرم بوده و در پنل کاربری امکان دانلود فاکتور تاییدشده وجود دارد.', 'خرید و سفارش', 1);
  insertFaq.run('منظور از گام سفارش ۵۰ عددی برای لیوان‌های بیرون‌بر چیست؟', 'اقلام مصرفی بسته‌بندی مانند لیوان‌های دوجداره در پک‌های پلمب ۵۰ عددی از خط تولید عرضه می‌شوند؛ بنابراین سیستم به‌صورت هوشمند تعداد را در مضارب ۵۰ تنظیم می‌کند تا بسته‌بندی بهداشتی حفظ شود.', 'خرید و سفارش', 2);
  insertFaq.run('سفارش‌های کارت‌به‌کارت چه زمانی تایید و ارسال می‌شوند؟', 'بلافاصله پس از آپلود تصویر فیش واریزی و شماره پیگیری در صفحه پیگیری سفارش، واحد مالی حداکثر ظرف ۳۰ دقیقه در ساعات کاری فیش را بررسی و سفارش را وارد مرحله آماده‌سازی می‌کند.', 'پرداخت و ارسال', 3);

  // 10. Seed SEO Metadata for all key URLs
  const insertSeo = db.prepare(`
    INSERT INTO seo_metadata (
      entity_type, entity_id, url_path, seo_title, meta_description, focus_keyword,
      secondary_keywords, canonical_url, robots_index, robots_follow, og_title, og_description,
      schema_type, seo_score, analysis_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?)
  `);

  const seoEntries: Array<{
    type: string; id: number; url: string; title: string; desc: string; kw: string; sec: string; schema: string; content: string;
  }> = [
    {
      type: 'page', id: 0, url: '/',
      title: 'باریستاپرو | خرید عمده ملزومات کافی‌شاپ، دان قهوه و لیوان بیرون‌بر',
      desc: 'تامین مستقیم ملزومات کافی‌شاپ شامل دان قهوه اسپرسو تازه رست، لیوان دوجداره کاغذی، سیروپ مونین، ابزار باریستا و شوینده دستگاه اسپرسو با ارسال سریع.',
      kw: 'ملزومات کافی‌شاپ',
      sec: 'خرید دان قهوه، تجهیزات باریستا، لیوان کاغذی عمده',
      schema: 'Organization',
      content: 'فروشگاه تخصصی ملزومات کافی‌شاپ باریستاپرو مرجع تامین دان قهوه اسپرسو، سیروپ و طعم‌دهنده‌ها، لیوان کاغذی دوجداره، فیلتر دمی و ابزار حرفه‌ای باریستا با ارسال فوری.',
    },
    {
      type: 'page', id: 0, url: '/products',
      title: 'فروشگاه ملزومات کافه و تجهیزات باریستا | لیست قیمت روز باریستاپرو',
      desc: 'مشاهده و مقایسه قیمت روز تمامی ملزومات مصرفی کافی‌شاپ از دان قهوه و پودر کاکائو تا تمپر و لیوان بیرون‌بر با فیلتر تخصصی برند و موجودی.',
      kw: 'ملزومات کافه',
      sec: 'لیست قیمت تجهیزات کافه، خرید اقلام مصرفی باریستا',
      schema: 'WebPage',
      content: 'مجموعه کامل ملزومات کافه شامل دان قهوه تخصصی، سیروپ کارامل و وانیل، لیوان بیرون‌بر، فیلتر V60 و پودر بک‌فلاش دستگاه اسپرسو.',
    },
    {
      type: 'page', id: 0, url: '/faq',
      title: 'سوالات متداول خرید عمده و ارسال ملزومات کافی‌شاپ | باریستاپرو',
      desc: 'پاسخ به پرسش‌های متداول کافه‌داران درباره نحوه خرید در مضارب ۵۰ عددی، روش‌های پرداخت آنلاین و کارت‌به‌کارت و ارسال فوری پیک در تهران.',
      kw: 'سوالات متداول',
      sec: 'راهنمای خرید کافی‌شاپ، ارسال کالا',
      schema: 'FAQPage',
      content: 'راهنمای کامل سوالات متداول خرید عمده، نحوه ثبت فیش کارت‌به‌کارت و ارسال فوری باربری و تیپاکس.',
    },
  ];

  // Auto-create SEO records for all seeded products & categories & blog posts
  const allProducts = db.prepare('SELECT id, title, slug, short_description, description FROM products').all() as any[];
  for (const pr of allProducts) {
    seoEntries.push({
      type: 'product',
      id: pr.id,
      url: `/product/${pr.slug}`,
      title: `خرید و قیمت ${pr.title} | باریستاپرو`,
      desc: pr.short_description,
      kw: pr.title.split(' ').slice(0, 3).join(' '),
      sec: 'فروشگاه ملزومات کافی‌شاپ',
      schema: 'Product',
      content: `${pr.short_description} ${pr.description}`,
    });
  }

  const allCats = db.prepare('SELECT id, name, slug, description FROM categories').all() as any[];
  for (const cat of allCats) {
    seoEntries.push({
      type: 'category',
      id: cat.id,
      url: `/category/${cat.slug}`,
      title: `خرید ${cat.name} با قیمت عمده کافه | باریستاپرو`,
      desc: cat.description || `مرجع تخصصی خرید انواع ${cat.name} با ضمانت اصالت و ارسال سریع.`,
      kw: cat.name,
      sec: 'تجهیزات و مواد اولیه کافه',
      schema: 'WebPage',
      content: cat.description || cat.name,
    });
  }

  const allBlogs = db.prepare('SELECT id, title, slug, excerpt, content FROM blog_posts').all() as any[];
  for (const bl of allBlogs) {
    seoEntries.push({
      type: 'blog',
      id: bl.id,
      url: `/blog/${bl.slug}`,
      title: `${bl.title} | آکادمی باریستاپرو`,
      desc: bl.excerpt,
      kw: bl.title.split(' ').slice(0, 2).join(' '),
      sec: 'آموزش باریستا',
      schema: 'BlogPosting',
      content: `${bl.excerpt} ${bl.content}`,
    });
  }

  for (const item of seoEntries) {
    const audit = analyzeSeoContent({
      url_path: item.url,
      seo_title: item.title,
      meta_description: item.desc,
      focus_keyword: item.kw,
      content_text: item.content,
      robots_index: true,
      schema_type: item.schema,
    });
    insertSeo.run(
      item.type, item.id, item.url, item.title, item.desc, item.kw, item.sec,
      item.url, item.title, item.desc, item.schema, audit.score, JSON.stringify(audit)
    );
  }

  // 11. Seed 1 Sample Historical Order so Admin & Customer Dashboards show real data immediately
  const sampleOrderNum = 'BP-1405-1001';
  const orderRes = db.prepare(`
    INSERT INTO orders (
      order_number, user_id, customer_name, customer_mobile, customer_email,
      shipping_address_snapshot, shipping_method_id, shipping_method_title,
      status, subtotal_amount, product_discount_amount, shipping_fee, total_payable,
      payment_method, tracking_code, paid_at
    ) VALUES (?, ?, 'سارا محمدی', '09121112233', 'sara@roastcafe.ir', ?, 1, 'پیک اختصاصی شهر تهران (ارسال فوری کافه‌ها)', 'delivered', 3400000, 440000, 0, 2960000, 'online_gateway', 'TRK-884120', datetime('now', '-2 days'))
  `).run(
    sampleOrderNum,
    custRes.lastInsertRowid,
    JSON.stringify({
      title: 'شعبه مرکزی کافه',
      receiver_name: 'سارا محمدی',
      receiver_mobile: '09121112233',
      province: 'تهران',
      city: 'تهران',
      postal_code: '1587743111',
      full_address: 'خیابان کریم‌خان زند، نبش خیابان خردمند شمالی، پلاک ۴۲، کافه رست',
    })
  );
  db.prepare(`
    INSERT INTO order_items (order_id, product_id, variant_id, product_title, variant_title, sku, unit_label, quantity, unit_price, regular_price, line_total)
    VALUES (?, ?, 1, 'دان قهوه اسپرسو سوماترا ۱۰۰٪ عربیکا آرتیسان', 'بسته ۱ کیلوگرمی - دان کامل', 'BP-BEAN-101-1KG', 'کیلوگرم / بسته', 2, 1320000, 1480000, 2640000)
  `).run(orderRes.lastInsertRowid, p1);
  db.prepare(`
    INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
    VALUES (?, NULL, 'paid', 'پرداخت آنلاین با موفقیت تایید شد', ?), (?, 'paid', 'delivered', 'مرسوله به کافه تحویل داده شد', ?)
  `).run(orderRes.lastInsertRowid, adminRes.lastInsertRowid, orderRes.lastInsertRowid, adminRes.lastInsertRowid);
  db.prepare(`
    INSERT INTO payments (order_id, method, gateway_name, authority_token, idempotency_key, reference_id, amount, status, verified_at)
    VALUES (?, 'online_gateway', 'شاپرک زرین‌پال (شبیه‌ساز استاندارد)', 'AUTH-SEED-1001', 'IDEM-SEED-1001', 'REF-99182736', 2960000, 'verified', datetime('now', '-2 days'))
  `).run(orderRes.lastInsertRowid);

  // Activity Log
  db.prepare(`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (?, 'system_seed', 'system', 0, 'راه‌اندازی اولیه دیتابیس و کاتالوگ محصولات کافی‌شاپ انجام شد')
  `).run(adminRes.lastInsertRowid);

  seedUpgradesIfEmpty();
}

export const ALL_PERMISSIONS = [
  'dashboard.view',
  'products.view',
  'products.create',
  'products.update',
  'products.delete',
  'media.manage',
  'categories.manage',
  'inventory.view',
  'inventory.adjust',
  'orders.view',
  'orders.update',
  'orders.cancel_refund',
  'payments.view',
  'payments.verify',
  'customers.view',
  'customers.update',
  'wholesale.manage',
  'coupons.manage',
  'menus.manage',
  'cms.manage',
  'seo.view',
  'seo.update',
  'shipping.manage',
  'users.manage',
  'audit.view',
  'settings.update',
  'reports.export',
  'system.health',
] as const;

export function seedUpgradesIfEmpty() {
  // Ensure admin users have super_admin role key
  db.prepare(`UPDATE users SET admin_role_key = 'super_admin' WHERE role = 'admin' AND (admin_role_key IS NULL OR admin_role_key = '')`).run();
  db.prepare(`UPDATE users SET admin_role_key = 'store_manager' WHERE role = 'manager' AND (admin_role_key IS NULL OR admin_role_key = '')`).run();

  // Populate default wholesale prices on variants missing wholesale_price
  db.prepare(`
    UPDATE product_variants
    SET wholesale_price = CAST(ROUND(regular_price * 0.85, -3) AS INTEGER)
    WHERE wholesale_price IS NULL AND regular_price > 10000
  `).run();
  db.prepare(`
    UPDATE product_variants
    SET wholesale_price = CAST(ROUND(regular_price * 0.85) AS INTEGER)
    WHERE wholesale_price IS NULL AND regular_price <= 10000
  `).run();

  // Seed CMS / Upgrade settings if missing
  const extraSettings: Record<string, string> = {
    hamburger_show_bestsellers: '1',
    hero_kicker: 'تامین مستقیم کافه‌ها و رستری‌ها · ارسال روزانه',
    hero_title: 'ملزومات تخصصی کافی‌شاپ با کیفیت تجاری و قیمت عمده',
    hero_subtitle: 'از دان قهوه اسپرسو تازه رُست و سیروپ‌های کافه‌ای تا لیوان دوجداره بیرون‌بر، فیلتر دمی و شوینده‌های استاندارد ماشین اسپرسو؛ همه یکجا با موجودی لحظه‌ای انبار.',
    hero_image: 'hero_coffee_roastery',
    hero_cta_label: 'مشاهده کاتالوگ محصولات',
    wholesale_enabled: '1',
    wholesale_min_order: '3000000',
    tax_rate_percent: '0',
    currency_label: 'تومان',
    invoice_prefix: 'BP-INV-',
  };
  const upsertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(extraSettings)) {
    upsertSetting.run(k, v);
  }

  // Seed default navigation_items if empty
  const navCount = (db.prepare('SELECT COUNT(*) as cnt FROM navigation_items').get() as { cnt: number }).cnt;
  if (navCount === 0) {
    const insNav = db.prepare(`
      INSERT INTO navigation_items (location, label, link_type, target_slug, target_url, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    insNav.run('both', 'خانه', 'page', '', '/', 1);
    insNav.run('both', 'محصولات', 'page', 'products', '/products', 2);
    insNav.run('both', 'آکادمی باریستا', 'page', 'blog', '/blog', 3);
    insNav.run('both', 'سوالات متداول', 'page', 'faq', '/faq', 4);
    insNav.run('both', 'درباره ما', 'page', 'about', '/about', 5);
    insNav.run('mobile_drawer', 'تماس با ما و خرید عمده', 'page', 'contact', '/contact', 6);
    insNav.run('mobile_drawer', 'دان قهوه اسپرسو سوماترا', 'product', 'sumatra-arabica-espresso-beans', '/product/sumatra-arabica-espresso-beans', 7);
    insNav.run('mobile_drawer', 'لیوان کاغذی دوجداره کرافت', 'product', 'double-wall-kraft-paper-cup-50pack', '/product/double-wall-kraft-paper-cup-50pack', 8);
  }

  // Seed default admin roles & permissions
  const roleCount = (db.prepare('SELECT COUNT(*) as cnt FROM admin_roles').get() as { cnt: number }).cnt;
  if (roleCount === 0) {
    const insRole = db.prepare('INSERT OR IGNORE INTO admin_roles (role_key, title_fa, description, is_system) VALUES (?, ?, ?, ?)');
    const insPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)');

    const roleDefs: Array<{ key: string; title: string; desc: string; perms: readonly string[] }> = [
      {
        key: 'super_admin',
        title: 'مدیر کل سیستم (Super Admin)',
        desc: 'دسترسی کامل به تمام ماژول‌ها، تنظیمات امنیتی، RBAC و لاگ‌ها',
        perms: ALL_PERMISSIONS,
      },
      {
        key: 'store_manager',
        title: 'مدیر فروشگاه',
        desc: 'مدیریت کامل سفارشات، محصولات، مشتریان، منوها و گزارش‌ها',
        perms: [
          'dashboard.view', 'products.view', 'products.create', 'products.update', 'products.delete',
          'media.manage', 'categories.manage', 'inventory.view', 'inventory.adjust',
          'orders.view', 'orders.update', 'orders.cancel_refund', 'payments.view', 'payments.verify',
          'customers.view', 'customers.update', 'wholesale.manage', 'coupons.manage',
          'menus.manage', 'cms.manage', 'seo.view', 'seo.update', 'shipping.manage', 'reports.export',
        ],
      },
      {
        key: 'product_manager',
        title: 'مدیر کاتالوگ و محصولات',
        desc: 'ساخت و ویرایش محصولات، تصاویر، دسته‌بندی‌ها، برندها و منوهای سایت',
        perms: ['dashboard.view', 'products.view', 'products.create', 'products.update', 'media.manage', 'categories.manage', 'menus.manage', 'inventory.view'],
      },
      {
        key: 'inventory_manager',
        title: 'مدیر انبار و موجودی',
        desc: 'ثبت ورود/خروج کالا، ضایعات، اصلاح موجودی و بررسی سفارشات',
        perms: ['dashboard.view', 'products.view', 'inventory.view', 'inventory.adjust', 'orders.view', 'reports.export'],
      },
      {
        key: 'order_manager',
        title: 'مدیر سفارشات و ارسال',
        desc: 'تغییر وضعیت سفارش، کد رهگیری، روش‌های ارسال و چاپ فاکتور',
        perms: ['dashboard.view', 'orders.view', 'orders.update', 'shipping.manage', 'customers.view'],
      },
      {
        key: 'finance_manager',
        title: 'مدیر مالی و تایید فیش',
        desc: 'بررسی تراکنش‌ها، تایید/رد فیش بانکی، استرداد و گزارش‌های فروش',
        perms: ['dashboard.view', 'orders.view', 'orders.cancel_refund', 'payments.view', 'payments.verify', 'coupons.manage', 'wholesale.manage', 'reports.export'],
      },
      {
        key: 'seo_manager',
        title: 'مدیر سئو و محتوا',
        desc: 'مدیریت موتور سئو، اسکیما، ریدایرکت، مقالات آکادمی، رسانه و منوها',
        perms: ['dashboard.view', 'seo.view', 'seo.update', 'cms.manage', 'menus.manage', 'media.manage'],
      },
    ];

    for (const r of roleDefs) {
      insRole.run(r.key, r.title, r.desc, 1);
      for (const p of r.perms) {
        insPerm.run(r.key, p);
      }
    }
  }
}
