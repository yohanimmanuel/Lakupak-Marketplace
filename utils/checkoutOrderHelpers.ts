import { API_BASE_URL } from '../services/config';

export function generateCheckoutOrderId(groupIndex?: number): string {
  const entropy = Math.floor(Math.random() * 100000000)
    .toString()
    .padStart(8, '0');
  const base = `LKO-${Date.now()}${entropy}`;
  return groupIndex != null ? `${base}-${groupIndex}` : base;
}

export function extractCreatedOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.orderId === 'string' && record.orderId.trim()) {
    return record.orderId.trim();
  }

  const nested = record.order ?? (Array.isArray(record.orders) ? record.orders[0] : null);
  if (nested && typeof nested === 'object') {
    const orderId = (nested as { orderId?: string }).orderId;
    if (typeof orderId === 'string' && orderId.trim()) return orderId.trim();
  }

  return null;
}

/** Best-effort rollback when multi-distributor checkout fails mid-loop. */
export async function rollbackCheckoutOrders(
  orderIds: string[],
  token: string,
): Promise<string[]> {
  const base = (API_BASE_URL || '').replace(/\/$/, '');
  const failedIds: string[] = [];

  await Promise.all(
    orderIds.map(async (orderId) => {
      try {
        const res = await fetch(`${base}/api/orders`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cancel: true,
            orderId,
            reason: 'Checkout rolled back because a related order could not be created.',
            reasonCode: 'other',
          }),
        });
        if (!res.ok) {
          failedIds.push(orderId);
        }
      } catch {
        failedIds.push(orderId);
      }
    }),
  );

  return failedIds;
}
