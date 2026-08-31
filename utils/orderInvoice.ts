/**
 * Shared invoice snapshot for HTML, plain text, and raster export (order details).
 */

export type OrderInvoiceLine = {
  title: string;
  subtitle?: string;
  qtyLine: string;
  amount: string;
};

export type OrderInvoiceSnapshot = {
  orderId: string;
  storeName: string;
  issuedAt: string;
  paymentStatus: string;
  paymentTerms: string;
  orderStatus: string;
  billToName: string;
  billToPhone: string;
  shipTo: string;
  lines: OrderInvoiceLine[];
  subtotal: string;
  discounts: string;
  shipping: string;
  total: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export type OrderLike = {
  orderId: string;
  storeName?: string;
  orderDate?: string;
  paymentStatus?: string;
  paymentTerms?: string;
  orderStatus?: string;
  contactPerson?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  subtotal?: number;
  discounts?: number;
  shippingFee?: number;
  totalAmount?: number;
  total?: number;
  orderItems?: Array<{
    productName?: string;
    name?: string;
    packageQuantity?: number;
    pricePerPackage?: number;
    unitPrice?: number;
    subtotal?: number;
    variantName?: string;
    variantNameSnapshot?: string;
    packageType?: string;
    piecesPerPackage?: number;
  }>;
};

export function buildInvoiceSnapshot(order: OrderLike): OrderInvoiceSnapshot {
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  const sumLineSubtotals = () =>
    items.reduce((acc, it) => acc + (typeof it.subtotal === 'number' ? it.subtotal : 0), 0);

  const lines: OrderInvoiceLine[] = items.map((it) => {
    const title = it.productName || it.name || 'Item';
    const variant = it.variantName || it.variantNameSnapshot;
    const qty = Math.max(1, it.packageQuantity ?? 1);
    const ppp = it.pricePerPackage ?? it.unitPrice ?? 0;
    const lineSub = typeof it.subtotal === 'number' ? it.subtotal : qty * ppp;
    const pkg = it.packageType ? ` · ${it.packageType}` : '';
    const subtitle = [variant ? `Var: ${variant}` : null, pkg || null].filter(Boolean).join('') || undefined;
    return {
      title,
      subtitle: subtitle || undefined,
      qtyLine: `${qty} × ${formatIdr(ppp)}`,
      amount: formatIdr(lineSub),
    };
  });

  let subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
  if (subtotal === 0 && items.length > 0) {
    const summed = sumLineSubtotals();
    if (summed > 0) subtotal = summed;
  }
  const discounts = typeof order.discounts === 'number' ? order.discounts : 0;
  const ship = typeof order.shippingFee === 'number' ? order.shippingFee : 0;
  const total =
    typeof order.totalAmount === 'number'
      ? order.totalAmount
      : typeof order.total === 'number'
        ? order.total
        : Math.max(0, subtotal - discounts + ship);

  const issued =
    order.orderDate && !Number.isNaN(new Date(order.orderDate).getTime())
      ? new Date(order.orderDate).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleString('en-GB');

  return {
    orderId: order.orderId,
    storeName: order.storeName?.trim() || 'Lakupak Marketplace',
    issuedAt: issued,
    paymentStatus: order.paymentStatus || '—',
    paymentTerms: order.paymentTerms || '—',
    orderStatus: order.orderStatus || '—',
    billToName: order.contactPerson?.trim() || '—',
    billToPhone: order.contactPhone?.trim() || '—',
    shipTo: order.deliveryAddress?.trim() || '—',
    lines,
    subtotal: formatIdr(subtotal),
    discounts: formatIdr(discounts),
    shipping: formatIdr(ship),
    total: formatIdr(total),
  };
}

/** Shown on invoice HTML, image export, and plain-text share. */
export function getInvoiceLegalFooter(): string {
  const y = new Date().getFullYear();
  return `© ${y} Lakupak. All rights reserved. This invoice is issued through Lakupak Marketplace. Use of the Lakupak platform is subject to Lakupak's Terms & Conditions and Privacy Policy.`;
}

export type BuildInvoiceHtmlOptions = {
  /** Resolved asset URI for the Laku logo PNG (e.g. from Image.resolveAssetSource). */
  logoUri?: string | null;
  /** Full data URI (e.g. data:image/png;base64,...) — preferred for WebView/PDF so local file URLs are not blocked. */
  logoDataUri?: string | null;
};

function htmlImgSrcAttr(src: string): string {
  if (src.startsWith('data:')) return src;
  return escapeHtml(src);
}

export function buildOrderInvoiceHtml(order: OrderLike, options?: BuildInvoiceHtmlOptions): string {
  const s = buildInvoiceSnapshot(order);
  const logoSrc =
    (options?.logoDataUri && options.logoDataUri.trim()) ||
    (options?.logoUri && options.logoUri.trim()) ||
    '';
  const logoBlock = logoSrc
    ? `<div class="logo-row"><img src="${htmlImgSrcAttr(logoSrc)}" alt="Lakupak" width="104" height="56" style="max-width:124px;height:auto;object-fit:contain;"/></div>`
    : '';
  const rows =
    s.lines.length > 0
      ? s.lines
          .map(
            (l) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;vertical-align:top;">
        <div style="font-weight:600;color:#111827;">${escapeHtml(l.title)}</div>
        ${l.subtitle ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(l.subtitle)}</div>` : ''}
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(l.qtyLine)}</div>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;font-weight:600;">${escapeHtml(l.amount)}</td>
    </tr>`
          )
          .join('')
      : `<tr><td colspan="2" style="padding:12px;color:#6b7280;">No line items</td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:16px;background:#f9fafb;color:#111827;}
  .card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08);max-width:560px;margin:0 auto;}
  .logo-row{text-align:left;margin-bottom:12px;}
  .brand{color:#0a61d7;font-weight:800;font-size:20px;margin-bottom:4px;}
  .muted{color:#6b7280;font-size:13px;}
  .legal{margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280;line-height:1.5;}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;}
  th{text-align:left;font-size:12px;color:#6b7280;padding:8px;border-bottom:1px solid #e5e7eb;}
  .tot{font-size:14px;margin-top:12px;}
  .tot-row{display:flex;justify-content:space-between;padding:6px 0;}
  .grand{font-size:18px;font-weight:800;color:#0a61d7;border-top:2px solid #e5e7eb;margin-top:8px;padding-top:12px;}
</style></head><body>
<div class="card">
  ${logoBlock}
  <div class="brand">${escapeHtml(s.storeName)}</div>
  <div class="muted">Tax invoice / Receipt</div>
  <div style="margin-top:16px;font-size:14px;">
    <div><strong>Order ID</strong> · ${escapeHtml(s.orderId)}</div>
    <div style="margin-top:6px;"><strong>Date</strong> · ${escapeHtml(s.issuedAt)}</div>
    <div style="margin-top:6px;"><strong>Status</strong> · ${escapeHtml(s.orderStatus)}</div>
    <div style="margin-top:6px;"><strong>Payment</strong> · ${escapeHtml(s.paymentStatus)}</div>
    <div style="margin-top:6px;"><strong>Terms</strong> · ${escapeHtml(s.paymentTerms)}</div>
  </div>
  <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;">
    <div><strong>Bill to</strong> · ${escapeHtml(s.billToName)} · ${escapeHtml(s.billToPhone)}</div>
    <div style="margin-top:8px;"><strong>Ship to</strong></div>
    <div style="color:#374151;">${escapeHtml(s.shipTo)}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    <div class="tot-row"><span>Subtotal</span><span>${escapeHtml(s.subtotal)}</span></div>
    <div class="tot-row"><span>Discounts</span><span>− ${escapeHtml(s.discounts)}</span></div>
    <div class="tot-row"><span>Shipping</span><span>${escapeHtml(s.shipping)}</span></div>
    <div class="tot-row grand"><span>Total</span><span>${escapeHtml(s.total)}</span></div>
  </div>
  <p class="muted" style="margin-top:16px;font-size:11px;">For order support, contact the seller or Lakupak Help Center.</p>
  <p class="legal">${escapeHtml(getInvoiceLegalFooter())}</p>
</div>
</body></html>`;
}

export function buildOrderInvoicePlainText(order: OrderLike): string {
  const s = buildInvoiceSnapshot(order);
  const lines = s.lines
    .map((l) => `• ${l.title}${l.subtitle ? ` (${l.subtitle})` : ''}\n  ${l.qtyLine} → ${l.amount}`)
    .join('\n');
  return [
    `${s.storeName} — Invoice`,
    `Order ID: ${s.orderId}`,
    `Date: ${s.issuedAt}`,
    `Status: ${s.orderStatus}`,
    `Payment: ${s.paymentStatus}`,
    `Terms: ${s.paymentTerms}`,
    '',
    `Bill to: ${s.billToName} · ${s.billToPhone}`,
    `Ship to: ${s.shipTo}`,
    '',
    lines || '(no items)',
    '',
    `Subtotal: ${s.subtotal}`,
    `Discounts: ${s.discounts}`,
    `Shipping: ${s.shipping}`,
    `TOTAL: ${s.total}`,
    '',
    '—',
    getInvoiceLegalFooter(),
  ].join('\n');
}
