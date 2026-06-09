import { MarketplaceProduct, marketplaceService } from '../services/marketplace';
import { selectVariantOptionByVariantName } from './variantRules';

export const REORDER_ELIGIBLE_STATUSES = ['Received'] as const;

export type ReorderSkippedReason = 'deleted' | 'missing_id' | 'not_found';

export type ReorderOrderItemInput = {
  productId?: string | null;
  productName?: string | null;
  productDeleted?: boolean;
  packageQuantity?: number | null;
  variantNameSnapshot?: string | null;
  variantName?: string | null;
};

export type ReorderOrderInput = {
  orderStatus?: string | null;
  orderItems?: ReorderOrderItemInput[] | null;
};

export type ReorderLineItem = {
  productId: string;
  quantity: number;
  variant: string;
  productName?: string;
};

export type ReorderSkippedItem = {
  productId?: string | null;
  productName?: string | null;
  reason: ReorderSkippedReason;
};

export function isReorderEligible(orderStatus?: string | null): boolean {
  if (!orderStatus) return false;
  return (REORDER_ELIGIBLE_STATUSES as readonly string[]).includes(orderStatus);
}

export function extractReorderLineItems(order: ReorderOrderInput): {
  lines: ReorderLineItem[];
  skipped: ReorderSkippedItem[];
} {
  const lines: ReorderLineItem[] = [];
  const skipped: ReorderSkippedItem[] = [];

  for (const item of order.orderItems ?? []) {
    if (item.productDeleted) {
      skipped.push({
        productId: item.productId,
        productName: item.productName,
        reason: 'deleted',
      });
      continue;
    }

    if (!item.productId) {
      skipped.push({
        productName: item.productName,
        reason: 'missing_id',
      });
      continue;
    }

    const variant =
      item.variantNameSnapshot?.trim() ||
      item.variantName?.trim() ||
      'Default';

    lines.push({
      productId: item.productId,
      quantity: Math.max(1, item.packageQuantity ?? 1),
      variant,
      productName: item.productName ?? undefined,
    });
  }

  return { lines, skipped };
}

function resolveVariantName(product: MarketplaceProduct, variant: string): string {
  if (!product.variantOptions?.length) {
    if (product.variants?.length) {
      const match = product.variants.find((v) => v.variantName === variant);
      if (match?.variantName) return match.variantName;
      return product.variants[0]?.variantName || 'Default';
    }
    return variant || 'Default';
  }

  const option = selectVariantOptionByVariantName(product, variant);
  if (option) return variant || 'Default';

  const fallback = selectVariantOptionByVariantName(product, 'Default');
  if (fallback) return 'Default';

  return variant || 'Default';
}

async function resolveProduct(
  productId: string,
  cachedProducts: MarketplaceProduct[],
  token?: string,
): Promise<MarketplaceProduct | null> {
  const cached = cachedProducts.find((p) => p.id === productId);
  if (cached) return cached;

  try {
    return await marketplaceService.getProductById(productId, token);
  } catch {
    return null;
  }
}

export type ReorderNavigationTarget = {
  productId: string;
  quantity: number;
  variantName: string;
};

export async function resolveReorderNavigationTarget(params: {
  order: ReorderOrderInput;
  products: MarketplaceProduct[];
  token?: string;
}): Promise<{ target: ReorderNavigationTarget | null; skipped: ReorderSkippedItem[] }> {
  const { order, products, token } = params;

  if (!isReorderEligible(order.orderStatus)) {
    return { target: null, skipped: [] };
  }

  const { lines, skipped } = extractReorderLineItems(order);
  if (lines.length === 0) {
    return { target: null, skipped };
  }

  const firstLine = lines[0];
  const product = await resolveProduct(firstLine.productId, products, token);
  if (!product) {
    return {
      target: null,
      skipped: [
        ...skipped,
        {
          productId: firstLine.productId,
          productName: firstLine.productName,
          reason: 'not_found',
        },
      ],
    };
  }

  return {
    target: {
      productId: firstLine.productId,
      quantity: firstLine.quantity,
      variantName: resolveVariantName(product, firstLine.variant),
    },
    skipped,
  };
}
