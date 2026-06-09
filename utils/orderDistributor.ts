/** Matches OrderDetails distributor company resolution (`user.company`). */
type DistributorOrderSource = {
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

export function getDistributorCompanyName(order: DistributorOrderSource): string | null {
  const company = order.user?.company
  if (company) {
    const fromCompany = company.name?.trim() || company.companyName?.trim()
    if (fromCompany) return fromCompany
  }

  const fromSeller = order.seller?.name?.trim() || order.seller?.companyName?.trim()
  if (fromSeller) return fromSeller

  return null
}
