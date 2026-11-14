import crypto from 'node:crypto';
import { db, withTransaction } from './db.ts';

export function logActivity(userId: number | null, action: string, entityType: string, entityId: number | null, details: string) {
  db.prepare(`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, action, entityType, entityId, details);
}

export function createNotification(userId: number | null, title: string, body: string, channel: 'in_app' | 'sms' | 'email' = 'in_app') {
  db.prepare(`
    INSERT INTO notifications (user_id, channel, title, body)
    VALUES (?, ?, ?, ?)
  `).run(userId, channel, title, body);
}

export function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

export function isUserWholesaleApproved(userId: number | null | undefined): boolean {
  if (!userId) return false;
  const user = db.prepare('SELECT customer_group, wholesale_status FROM users WHERE id = ?').get(userId) as any;
  if (!user) return false;
  return user.wholesale_status === 'approved' || user.customer_group === 'wholesale' || user.customer_group === 'vip';
}

export function getEffectiveVariantPrice(variant: { regular_price: number; discount_price?: number | null; wholesale_price?: number | null }, isWholesale: boolean): number {
  const retail = variant.discount_price && variant.discount_price < variant.regular_price ? variant.discount_price : variant.regular_price;
  if (isWholesale && variant.wholesale_price && variant.wholesale_price > 0) {
    return Math.min(retail, variant.wholesale_price);
  }
  return retail;
}

export function getOrCreateCart(userId: number | null, guestToken: string | null) {
  if (userId) {
    let cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(userId) as any;
    if (!cart) {
      const res = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(userId);
      cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(res.lastInsertRowid);
    }
    return cart;
  }
  if (guestToken) {
    let cart = db.prepare('SELECT * FROM carts WHERE guest_token = ?').get(guestToken) as any;
    if (!cart) {
      const res = db.prepare('INSERT INTO carts (guest_token) VALUES (?)').run(guestToken);
      cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(res.lastInsertRowid);
    }
    return cart;
  }
  throw new Error('Missing cart identifier');
}

export function mergeGuestCartToUser(guestToken: string | null, userId: number) {
  if (!guestToken) return;
  const guestCart = db.prepare('SELECT * FROM carts WHERE guest_token = ?').get(guestToken) as any;
  if (!guestCart) return;

  withTransaction(() => {
    const userCart = getOrCreateCart(userId, null);
    const guestItems = db.prepare('SELECT * FROM cart_items WHERE cart_id = ?').all(guestCart.id) as any[];
    for (const item of guestItems) {
      const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND variant_id = ?').get(userCart.id, item.variant_id) as any;
      const variant = db.prepare(`
        SELECT pv.*, p.min_order_qty, p.order_step_qty, p.max_order_qty
        FROM product_variants pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = ?
      `).get(item.variant_id) as any;
      if (!variant) continue;
      const available = Math.max(0, variant.stock_quantity - variant.reserved_quantity);
      const mergedQty = Math.min(available, (existing ? existing.quantity : 0) + item.quantity);
      if (mergedQty <= 0) continue;

      if (existing) {
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(mergedQty, existing.id);
      } else {
        db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)').run(
          userCart.id, item.product_id, item.variant_id, mergedQty
        );
      }
    }
    if (guestCart.coupon_code && !userCart.coupon_code) {
      db.prepare('UPDATE carts SET coupon_code = ? WHERE id = ?').run(guestCart.coupon_code, userCart.id);
    }
    db.prepare('DELETE FROM carts WHERE id = ?').run(guestCart.id);
  });
}

export function calculateShippingFee(methodId: number | null, totalWeightGrams: number, afterProductDiscountAmount: number): {
  method: any | null;
  fee: number;
} {
  if (!methodId) return { method: null, fee: 0 };
  const method = db.prepare('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1').get(methodId) as any;
  if (!method) return { method: null, fee: 0 };

  if (method.free_threshold && afterProductDiscountAmount >= method.free_threshold) {
    return { method, fee: 0 };
  }
  if (method.calc_type === 'weight_based') {
    const kg = Math.max(1, Math.ceil(totalWeightGrams / 1000));
    return { method, fee: method.base_cost + kg * method.per_kg_cost };
  }
  return { method, fee: method.base_cost };
}

export function evaluateCoupon(code: string | null, orderAmount: number): {
  valid: boolean;
  coupon: any | null;
  discount: number;
  message?: string;
} {
  if (!code || !code.trim()) return { valid: false, coupon: null, discount: 0 };
  const cleanCode = code.trim().toUpperCase();
  const coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1').get(cleanCode) as any;
  if (!coupon) return { valid: false, coupon: null, discount: 0, message: 'کد تخفیف معتبر نیست یا منقضی شده است.' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, coupon: null, discount: 0, message: 'مهلت استفاده از این کد تخفیف به پایان رسیده است.' };
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, coupon: null, discount: 0, message: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.' };
  }
  if (orderAmount < coupon.min_order_amount) {
    return {
      valid: false,
      coupon: null,
      discount: 0,
      message: `حداقل مبلغ سبد خرید برای این کد ${coupon.min_order_amount.toLocaleString('fa-IR')} تومان است.`,
    };
  }

  let discount = 0;
  if (coupon.discount_type === 'percent') {
    discount = Math.floor((orderAmount * coupon.discount_value) / 100);
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, coupon.max_discount_amount);
    }
  } else {
    discount = Math.min(orderAmount, coupon.discount_value);
  }

  return { valid: true, coupon, discount };
}

export function getCartSummary(cartId: number, shippingMethodId: number | null = null) {
  const cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(cartId) as any;
  const isWholesale = isUserWholesaleApproved(cart?.user_id);
  const rows = db.prepare(`
    SELECT
      ci.id as item_id, ci.quantity, ci.product_id, ci.variant_id,
      p.title as product_title, p.slug as product_slug, p.main_image, p.unit_label_fa,
      p.min_order_qty, p.order_step_qty, p.max_order_qty, p.weight_grams, p.is_published, p.complementary_ids,
      pv.sku, pv.variant_title, pv.regular_price, pv.discount_price, pv.wholesale_price, pv.stock_quantity, pv.reserved_quantity, pv.is_active as variant_active
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN product_variants pv ON pv.id = ci.variant_id
    WHERE ci.cart_id = ?
    ORDER BY ci.added_at DESC
  `).all(cartId) as any[];

  let totalQuantity = 0;
  let subtotalRegular = 0;
  let productDiscountTotal = 0;
  let totalWeightGrams = 0;
  const complementaryIdSet = new Set<number>();
  const cartProductIds = new Set<number>();

  const items = rows.map((r) => {
    cartProductIds.add(r.product_id);
    try {
      const comps = JSON.parse(r.complementary_ids || '[]');
      if (Array.isArray(comps)) comps.forEach((cid: number) => complementaryIdSet.add(cid));
    } catch {
      // ignore
    }

    const availableStock = Math.max(0, r.stock_quantity - r.reserved_quantity);
    const unitPrice = getEffectiveVariantPrice(r, isWholesale);
    const unitDiscount = Math.max(0, r.regular_price - unitPrice);
    const lineRegular = r.regular_price * r.quantity;
    const lineTotal = unitPrice * r.quantity;
    const isAvailable = r.is_published === 1 && r.variant_active === 1 && availableStock >= r.quantity;
    const isLowStock = availableStock > 0 && availableStock <= Math.max(5, r.order_step_qty * 2);

    totalQuantity += r.quantity;
    subtotalRegular += lineRegular;
    productDiscountTotal += unitDiscount * r.quantity;
    totalWeightGrams += (r.weight_grams || 0) * r.quantity;

    return {
      item_id: r.item_id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      product_title: r.product_title,
      product_slug: r.product_slug,
      main_image: r.main_image,
      unit_label_fa: r.unit_label_fa,
      variant_title: r.variant_title,
      sku: r.sku,
      quantity: r.quantity,
      min_order_qty: r.min_order_qty,
      order_step_qty: r.order_step_qty,
      max_order_qty: r.max_order_qty,
      regular_price: r.regular_price,
      wholesale_price: r.wholesale_price,
      unit_price: unitPrice,
      line_total: lineTotal,
      line_discount: unitDiscount * r.quantity,
      available_stock: availableStock,
      is_available: isAvailable,
      is_low_stock: isLowStock,
      is_wholesale_price: Boolean(isWholesale && r.wholesale_price && unitPrice === r.wholesale_price),
    };
  });

  const afterProductDiscount = subtotalRegular - productDiscountTotal;
  const couponEval = evaluateCoupon(cart?.coupon_code || null, afterProductDiscount);
  const couponDiscount = couponEval.valid ? couponEval.discount : 0;
  const netMerchandise = Math.max(0, afterProductDiscount - couponDiscount);

  const freeShippingThreshold = Number(getSetting('free_shipping_threshold', '5000000')) || 5000000;
  const freeShippingRemaining = Math.max(0, freeShippingThreshold - afterProductDiscount);
  const freeShippingPercent = Math.min(100, Math.round((afterProductDiscount / freeShippingThreshold) * 100));

  const shippingCalc = calculateShippingFee(shippingMethodId, totalWeightGrams, afterProductDiscount);
  const totalPayable = netMerchandise + shippingCalc.fee;

  // Complementary suggestions
  const suggestionIds = Array.from(complementaryIdSet).filter((id) => !cartProductIds.has(id)).slice(0, 4);
  let complementaryProducts: any[] = [];
  if (suggestionIds.length > 0) {
    const placeholders = suggestionIds.map(() => '?').join(',');
    complementaryProducts = db.prepare(`
      SELECT p.id, p.title, p.slug, p.main_image, p.unit_label_fa, p.min_order_qty, p.order_step_qty,
             pv.id as default_variant_id, pv.regular_price, pv.discount_price, pv.stock_quantity, pv.reserved_quantity
      FROM products p
      JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
      WHERE p.id IN (${placeholders}) AND p.is_published = 1
      GROUP BY p.id
    `).all(...suggestionIds);
  }

  return {
    cart_id: cartId,
    items,
    total_quantity: totalQuantity,
    subtotal_regular: subtotalRegular,
    product_discount_amount: productDiscountTotal,
    after_product_discount: afterProductDiscount,
    coupon_code: couponEval.valid ? couponEval.coupon.code : null,
    coupon_discount_amount: couponDiscount,
    coupon_error: cart?.coupon_code && !couponEval.valid ? couponEval.message : null,
    shipping_fee: shippingCalc.fee,
    shipping_method: shippingCalc.method,
    total_payable: totalPayable,
    total_weight_grams: totalWeightGrams,
    free_shipping_threshold: freeShippingThreshold,
    free_shipping_remaining: freeShippingRemaining,
    free_shipping_percent: freeShippingPercent,
    has_unavailable_items: items.some((i) => !i.is_available),
    is_wholesale_applied: isWholesale,
    complementary_products: complementaryProducts,
  };
}

export function validateAndNormalizeQuantity(requestedQty: number, minQty: number, stepQty: number, maxQty: number | null, availableStock: number): {
  ok: boolean;
  quantity: number;
  error?: string;
} {
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return { ok: false, quantity: 0, error: 'تعداد سفارش باید بزرگ‌تر از صفر باشد.' };
  }
  const qty = Math.floor(requestedQty);
  if (qty < minQty) {
    return { ok: false, quantity: minQty, error: `حداقل تعداد سفارش برای این کالا ${minQty} است.` };
  }
  if (stepQty > 1 && (qty - minQty) % stepQty !== 0) {
    return { ok: false, quantity: qty, error: `تعداد سفارش این کالا باید مضربی از ${stepQty} باشد.` };
  }
  if (maxQty && qty > maxQty) {
    return { ok: false, quantity: maxQty, error: `حداکثر تعداد مجاز در هر سفارش ${maxQty} است.` };
  }
  if (qty > availableStock) {
    return { ok: false, quantity: availableStock, error: `موجودی قابل فروش تنها ${availableStock} عدد است.` };
  }
  return { ok: true, quantity: qty };
}

export function createOrderFromCart(params: {
  cartId: number;
  userId: number | null;
  guestToken: string | null;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  shippingAddress: {
    receiver_name: string;
    receiver_mobile: string;
    province: string;
    city: string;
    postal_code: string;
    full_address: string;
  };
  shippingMethodId: number;
  paymentMethod: 'online_gateway' | 'bank_transfer';
}) {
  return withTransaction(() => {
    const summary = getCartSummary(params.cartId, params.shippingMethodId);
    if (summary.items.length === 0) {
      throw new Error('سبد خرید شما خالی است.');
    }
    if (!summary.shipping_method) {
      throw new Error('لطفاً روش ارسال معتبر انتخاب نمایید.');
    }

    // Re-check and reserve stock atomically for every cart item
    for (const item of summary.items) {
      const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND is_active = 1').get(item.variant_id) as any;
      if (!variant) {
        throw new Error(`تنوع «${item.variant_title}» دیگر فعال نیست.`);
      }
      const available = variant.stock_quantity - variant.reserved_quantity;
      if (available < item.quantity) {
        throw new Error(`موجودی «${item.product_title} (${item.variant_title})» کافی نیست. موجودی فعلی: ${Math.max(0, available)}`);
      }
      db.prepare('UPDATE product_variants SET reserved_quantity = reserved_quantity + ? WHERE id = ?').run(
        item.quantity,
        item.variant_id
      );
      db.prepare(`
        INSERT INTO inventory_movements (variant_id, type, quantity_delta, reference_type, note, created_by)
        VALUES (?, 'reserve', ?, 'order_pending', ?, ?)
      `).run(item.variant_id, -item.quantity, `رزرو موقت در ثبت سفارش`, params.userId);
    }

    const orderNumber = `BP-1405-${Math.floor(100000 + Math.random() * 899999)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const orderRes = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, guest_token, customer_name, customer_mobile, customer_email,
        shipping_address_snapshot, shipping_method_id, shipping_method_title,
        status, subtotal_amount, product_discount_amount, coupon_code, coupon_discount_amount,
        shipping_fee, total_payable, payment_method, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      params.userId,
      params.guestToken,
      params.customerName,
      params.customerMobile,
      params.customerEmail || null,
      JSON.stringify(params.shippingAddress),
      params.shippingMethodId,
      summary.shipping_method.title,
      summary.subtotal_regular,
      summary.product_discount_amount,
      summary.coupon_code,
      summary.coupon_discount_amount,
      summary.shipping_fee,
      summary.total_payable,
      params.paymentMethod,
      expiresAt
    );

    const orderId = Number(orderRes.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, variant_id, product_title, variant_title, sku, unit_label,
        quantity, unit_price, regular_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of summary.items) {
      insertItem.run(
        orderId,
        item.product_id,
        item.variant_id,
        item.product_title,
        item.variant_title,
        item.sku,
        item.unit_label_fa,
        item.quantity,
        item.unit_price,
        item.regular_price,
        item.line_total
      );
    }

    if (summary.coupon_code) {
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(summary.coupon_code);
    }

    db.prepare(`
      INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
      VALUES (?, NULL, 'pending_payment', 'سفارش ثبت شد و در انتظار پرداخت است.', ?)
    `).run(orderId, params.userId);

    const authorityToken = `AUTH-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const idempotencyKey = `IDEM-${orderId}-${crypto.randomBytes(8).toString('hex')}`;

    db.prepare(`
      INSERT INTO payments (order_id, method, gateway_name, authority_token, idempotency_key, amount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      orderId,
      params.paymentMethod,
      params.paymentMethod === 'online_gateway' ? 'درگاه پرداخت شاپرک (آداپتور استاندارد)' : 'کارت‌به‌کارت بانکی',
      authorityToken,
      idempotencyKey,
      summary.total_payable
    );

    // Clear cart after order creation
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(params.cartId);
    db.prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?').run(params.cartId);

    createNotification(
      params.userId,
      `ثبت سفارش ${orderNumber}`,
      `سفارش شما به مبلغ ${summary.total_payable.toLocaleString('fa-IR')} تومان ثبت شد.`
    );

    return {
      order_id: orderId,
      order_number: orderNumber,
      total_payable: summary.total_payable,
      payment_method: params.paymentMethod,
      authority_token: authorityToken,
    };
  });
}

// Idempotent Server-to-Server Online Gateway Verification
export function verifyOnlineGatewayPayment(authorityToken: string, gatewaySuccess: boolean, gatewayRefId?: string) {
  return withTransaction(() => {
    const payment = db.prepare('SELECT * FROM payments WHERE authority_token = ?').get(authorityToken) as any;
    if (!payment) {
      throw new Error('تراکنش پرداخت یافت نشد.');
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id) as any;
    if (!order) {
      throw new Error('سفارش مرتبط یافت نشد.');
    }

    // Idempotency guard: never process an already-verified or failed callback twice
    if (payment.status !== 'pending') {
      return {
        already_processed: true,
        status: payment.status,
        order_number: order.order_number,
        reference_id: payment.reference_id,
      };
    }

    if (gatewaySuccess) {
      const refId = gatewayRefId || `SHP-${Math.floor(10000000 + Math.random() * 89999999)}`;
      db.prepare(`
        UPDATE payments SET status = 'verified', reference_id = ?, verified_at = datetime('now') WHERE id = ?
      `).run(refId, payment.id);

      db.prepare(`
        UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?
      `).run(order.id);

      db.prepare(`
        INSERT INTO order_status_histories (order_id, old_status, new_status, note)
        VALUES (?, ?, 'paid', ?)
      `).run(order.id, order.status, `پرداخت آنلاین تایید شد (کد مرجع: ${refId})`);

      // Finalize reserved stock -> deduct actual stock_quantity and increment sales_count
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
      for (const item of items) {
        db.prepare(`
          UPDATE product_variants
          SET stock_quantity = MAX(0, stock_quantity - ?),
              reserved_quantity = MAX(0, reserved_quantity - ?)
          WHERE id = ?
        `).run(item.quantity, item.quantity, item.variant_id);
        db.prepare('UPDATE products SET sales_count = sales_count + ? WHERE id = ?').run(item.quantity, item.product_id);
        db.prepare(`
          INSERT INTO inventory_movements (variant_id, type, quantity_delta, reference_type, reference_id, note)
          VALUES (?, 'out', ?, 'order_paid', ?, ?)
        `).run(item.variant_id, -item.quantity, order.id, `کسر قطعی موجودی سفارش ${order.order_number}`);
      }

      createNotification(order.user_id, `تایید پرداخت ${order.order_number}`, `پرداخت آنلاین سفارش ${order.order_number} با موفقیت تایید شد.`);

      return {
        already_processed: false,
        status: 'verified',
        order_number: order.order_number,
        reference_id: refId,
      };
    } else {
      db.prepare(`UPDATE payments SET status = 'failed' WHERE id = ?`).run(payment.id);
      db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(order.id);
      db.prepare(`
        INSERT INTO order_status_histories (order_id, old_status, new_status, note)
        VALUES (?, ?, 'cancelled', 'پرداخت آنلاین ناموفق یا توسط کاربر لغو شد.')
      `).run(order.id, order.status);

      // Release reserved stock
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
      for (const item of items) {
        db.prepare(`
          UPDATE product_variants SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?
        `).run(item.quantity, item.variant_id);
        db.prepare(`
          INSERT INTO inventory_movements (variant_id, type, quantity_delta, reference_type, reference_id, note)
          VALUES (?, 'release', ?, 'order_cancelled', ?, ?)
        `).run(item.variant_id, item.quantity, order.id, `آزادسازی موجودی سفارش لغو شده ${order.order_number}`);
      }

      return {
        already_processed: false,
        status: 'failed',
        order_number: order.order_number,
        reference_id: null,
      };
    }
  });
}

// Admin Manual Bank Transfer Approval / Rejection
export function reviewBankTransferReceipt(paymentId: number, adminUserId: number, approve: boolean, rejectionReason?: string) {
  return withTransaction(() => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
    if (!payment) throw new Error('رکورد پرداخت یافت نشد.');
    if (payment.method !== 'bank_transfer') throw new Error('این تراکنش از نوع کارت‌به‌کارت نیست.');
    if (payment.status !== 'pending') throw new Error('وضعیت این فیش قبلاً تعیین شده است.');

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id) as any;
    if (!order) throw new Error('سفارش یافت نشد.');

    if (approve) {
      db.prepare(`
        UPDATE payments SET status = 'verified', verified_by = ?, verified_at = datetime('now') WHERE id = ?
      `).run(adminUserId, paymentId);

      db.prepare(`
        UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?
      `).run(order.id);

      db.prepare(`
        INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
        VALUES (?, ?, 'paid', 'فیش واریزی کارت‌به‌کارت توسط واحد مالی تایید شد.', ?)
      `).run(order.id, order.status, adminUserId);

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
      for (const item of items) {
        db.prepare(`
          UPDATE product_variants
          SET stock_quantity = MAX(0, stock_quantity - ?),
              reserved_quantity = MAX(0, reserved_quantity - ?)
          WHERE id = ?
        `).run(item.quantity, item.quantity, item.variant_id);
        db.prepare('UPDATE products SET sales_count = sales_count + ? WHERE id = ?').run(item.quantity, item.product_id);
        db.prepare(`
          INSERT INTO inventory_movements (variant_id, type, quantity_delta, reference_type, reference_id, note, created_by)
          VALUES (?, 'out', ?, 'bank_transfer_verified', ?, ?, ?)
        `).run(item.variant_id, -item.quantity, order.id, `تایید فیش بانکی ${order.order_number}`, adminUserId);
      }

      logActivity(adminUserId, 'approve_bank_receipt', 'payment', paymentId, `تایید فیش واریزی سفارش ${order.order_number}`);
      createNotification(order.user_id, `تایید واریز وجه ${order.order_number}`, 'فیش کارت‌به‌کارت شما تایید شد و سفارش وارد مرحله آماده‌سازی گردید.');
    } else {
      const reason = rejectionReason?.trim() || 'مغایرت مبلغ یا تصویر فیش ناخوانا است.';
      db.prepare(`
        UPDATE payments SET status = 'rejected', rejection_reason = ?, verified_by = ?, verified_at = datetime('now') WHERE id = ?
      `).run(reason, adminUserId, paymentId);

      db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(order.id);
      db.prepare(`
        INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
        VALUES (?, ?, 'cancelled', ?, ?)
      `).run(order.id, order.status, `رد فیش واریزی: ${reason}`, adminUserId);

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
      for (const item of items) {
        db.prepare(`
          UPDATE product_variants SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?
        `).run(item.quantity, item.variant_id);
        db.prepare(`
          INSERT INTO inventory_movements (variant_id, type, quantity_delta, reference_type, reference_id, note, created_by)
          VALUES (?, 'release', ?, 'bank_transfer_rejected', ?, ?, ?)
        `).run(item.variant_id, item.quantity, order.id, `رد فیش بانکی ${order.order_number}`, adminUserId);
      }

      logActivity(adminUserId, 'reject_bank_receipt', 'payment', paymentId, `رد فیش سفارش ${order.order_number}: ${reason}`);
      createNotification(order.user_id, `عدم تایید فیش ${order.order_number}`, `فیش واریزی شما به دلیل «${reason}» رد شد.`);
    }

    return { ok: true, approved: approve };
  });
}

export function cancelOrderWithStockRestore(orderId: number, adminUserId: number, reason: string) {
  return withTransaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('سفارش یافت نشد.');
    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new Error('این سفارش قبلاً لغو یا مسترد شده است.');
    }

    const cleanReason = reason?.trim() || 'لغو توسط مدیر سیستم';
    const wasPaid = ['paid', 'processing', 'preparing', 'shipped', 'delivered'].includes(order.status);

    db.prepare(`
      UPDATE orders SET status = 'cancelled', cancel_reason = ?, stock_restored = 1 WHERE id = ?
    `).run(cleanReason, orderId);

    db.prepare(`
      INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
      VALUES (?, ?, 'cancelled', ?, ?)
    `).run(orderId, order.status, `لغو سفارش: ${cleanReason}`, adminUserId);

    if (!order.stock_restored) {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
      for (const item of items) {
        const v = db.prepare('SELECT stock_quantity, reserved_quantity FROM product_variants WHERE id = ?').get(item.variant_id) as any;
        if (!v) continue;
        if (wasPaid) {
          const prevQty = v.stock_quantity;
          const nextQty = prevQty + item.quantity;
          db.prepare('UPDATE product_variants SET stock_quantity = ? WHERE id = ?').run(nextQty, item.variant_id);
          db.prepare(`
            INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, reference_id, note, created_by)
            VALUES (?, 'in', ?, ?, ?, 'order_cancelled_restore', ?, ?, ?)
          `).run(item.variant_id, item.quantity, prevQty, nextQty, orderId, `بازگشت موجودی لغو سفارش ${order.order_number}`, adminUserId);
        } else {
          db.prepare('UPDATE product_variants SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?').run(
            item.quantity,
            item.variant_id
          );
          db.prepare(`
            INSERT INTO inventory_movements (variant_id, type, quantity_delta, previous_quantity, new_quantity, reference_type, reference_id, note, created_by)
            VALUES (?, 'release', ?, ?, ?, 'order_cancelled', ?, ?, ?)
          `).run(item.variant_id, item.quantity, v.stock_quantity, v.stock_quantity, orderId, `آزادسازی رزرو سفارش ${order.order_number}`, adminUserId);
        }
      }
    }

    logActivity(adminUserId, 'cancel_order', 'order', orderId, `لغو سفارش ${order.order_number}: ${cleanReason}`);
    createNotification(order.user_id, `لغو سفارش ${order.order_number}`, `سفارش شما به دلیل «${cleanReason}» لغو گردید.`);
    return { ok: true, was_paid: wasPaid };
  });
}

export function recordOrderRefund(orderId: number, adminUserId: number, amount: number, note: string) {
  return withTransaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('سفارش یافت نشد.');
    const refundAmt = Math.floor(Number(amount) || 0);
    if (refundAmt <= 0) throw new Error('مبلغ استرداد باید بزرگ‌تر از صفر باشد.');

    const remainingRefundable = order.total_payable - (order.refunded_amount || 0);
    if (refundAmt > remainingRefundable) {
      throw new Error(`حداکثر مبلغ قابل استرداد ${remainingRefundable.toLocaleString('fa-IR')} تومان است.`);
    }

    const totalRefunded = (order.refunded_amount || 0) + refundAmt;
    const isFullRefund = totalRefunded >= order.total_payable;

    db.prepare(`
      UPDATE orders SET refunded_amount = ?, status = ? WHERE id = ?
    `).run(totalRefunded, isFullRefund ? 'refunded' : order.status, orderId);

    db.prepare(`
      INSERT INTO order_status_histories (order_id, old_status, new_status, note, changed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orderId,
      order.status,
      isFullRefund ? 'refunded' : order.status,
      `ثبت استرداد وجه به مبلغ ${refundAmt.toLocaleString('fa-IR')} تومان${note ? ` (${note})` : ''}`,
      adminUserId
    );

    logActivity(adminUserId, 'refund_order', 'order', orderId, `استرداد ${refundAmt.toLocaleString('fa-IR')} تومان برای سفارش ${order.order_number}`);
    createNotification(order.user_id, `استرداد وجه سفارش ${order.order_number}`, `مبلغ ${refundAmt.toLocaleString('fa-IR')} تومان در حال واریز به حساب شماست.`);
    return { ok: true, refunded_amount: totalRefunded, is_full_refund: isFullRefund };
  });
}
