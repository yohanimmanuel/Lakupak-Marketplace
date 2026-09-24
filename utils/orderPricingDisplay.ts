/**
 * Buyer-facing money display — match Marketplace-Web.
 * The mobile orders API already hides catalog prices unless a client rate,
 * first-order auto-apply, or Send pricing applies. Show an amount only when
 * the returned line or order total is above zero.
 */

export function moneyAmount(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function isLinePricingPending(item: {
  subtotal?: unknown;
  pricePerPackage?: unknown;
  unitPrice?: unknown;
}): boolean {
  const subtotal = moneyAmount(item.subtotal);
  if (subtotal > 0) return false;
  const unit = moneyAmount(item.pricePerPackage ?? item.unitPrice);
  return !(unit > 0);
}

export function isOrderPricingPending(order: {
  totalAmount?: unknown;
  total?: unknown;
  orderItems?: Array<{
    subtotal?: unknown;
    pricePerPackage?: unknown;
    unitPrice?: unknown;
  }> | null;
}): boolean {
  const items = order.orderItems ?? [];
  if (items.some((item) => isLinePricingPending(item))) return true;
  return !(moneyAmount(order.totalAmount ?? order.total) > 0);
}

export function lineDisplayAmount(item: {
  subtotal?: unknown;
  pricePerPackage?: unknown;
  unitPrice?: unknown;
  packageQuantity?: unknown;
  quantity?: unknown;
}): number {
  const subtotal = moneyAmount(item.subtotal);
  if (subtotal > 0) return subtotal;
  const unit = moneyAmount(item.pricePerPackage ?? item.unitPrice);
  const qty = moneyAmount(item.packageQuantity ?? item.quantity) || 1;
  return unit * qty;
}
