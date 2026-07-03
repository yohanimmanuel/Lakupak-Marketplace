/** Resolve distributor (seller) dashboard user id from an order payload. */
export function resolveDistributorUserId(
  order:
    | {
        distributorUserId?: number | string | null;
        sellerUserId?: number | string | null;
        sellerId?: number | string | null;
        distributorId?: number | string | null;
        user?: unknown;
      }
    | null
    | undefined,
): number | null {
  const userRecord =
    order?.user && typeof order.user === 'object'
      ? (order.user as { id?: number | string | null })
      : null;

  const candidates = [
    order?.distributorUserId,
    order?.sellerUserId,
    order?.sellerId,
    order?.distributorId,
    userRecord?.id,
  ];

  for (const raw of candidates) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  return null;
}
