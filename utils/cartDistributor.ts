import { MarketplaceProduct } from '../services/marketplace';

export function slugifyDistributorKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function resolveDistributorId(product?: MarketplaceProduct | null): string {
  if (!product) return 'unknown';

  const company = product.seller?.company;

  if (company?.name) {
    const base = slugifyDistributorKey(company.name);
    if (product.userId !== undefined && product.userId !== null) {
      return `company-${base}-${product.userId}`;
    }
    return `company-${base}-${slugifyDistributorKey(product.id)}`;
  }

  if (product.userId !== undefined && product.userId !== null) {
    return `user-${product.userId}`;
  }

  if (product.seller?.name) {
    return `seller-${slugifyDistributorKey(product.seller.name)}-${slugifyDistributorKey(product.id)}`;
  }

  return `product-${slugifyDistributorKey(product.id)}`;
}

export function getDistributorDisplayName(
  product?: MarketplaceProduct | null,
  fallback = 'Distributor',
): string {
  if (!product) return fallback;
  return (
    product.seller?.company?.name?.trim() ||
    product.seller?.name?.trim() ||
    fallback
  );
}
