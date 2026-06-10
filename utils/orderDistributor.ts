/**
 * Resolves distributor company name for order list/detail UI.
 * Prefer company fields — never use Order.storeName (that is the buyer's marketplace store).
 */
type DistributorOrderSource = {
  /** Buyer store on the order record — do not use for distributor display. */
  storeName?: string | null
  user?: {
    company?: {
      name?: string | null
      companyName?: string | null
    } | null
  } | null
  seller?: {
    companyName?: string | null
    name?: string | null
  } | null
}

function pickCompanyLabel(
  company?: { name?: string | null; companyName?: string | null } | null,
): string | null {
  if (!company) return null
  return company.companyName?.trim() || company.name?.trim() || null
}

export function getDistributorCompanyName(order: DistributorOrderSource): string | null {
  const fromSellerCompany = order.seller?.companyName?.trim()
  if (fromSellerCompany) return fromSellerCompany

  const fromUserCompany = pickCompanyLabel(order.user?.company)
  if (fromUserCompany) return fromUserCompany

  const fromSellerContact = order.seller?.name?.trim()
  if (fromSellerContact) return fromSellerContact

  return null
}
