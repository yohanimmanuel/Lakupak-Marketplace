/** Normalize catalog stock units for quantity / stock labels. */
export function displayStockUnit(raw?: string | null): string {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value || /^(pc|pcs|piece|pieces)$/.test(value)) return 'pieces';
  if (/^(box|boxes)$/.test(value)) return 'boxes';
  if (/^(carton|cartons)$/.test(value)) return 'cartons';
  return value;
}

/** Title-case stock unit for “Stock: Pieces” style labels. */
export function displayStockUnitLabel(raw?: string | null): string {
  const unit = displayStockUnit(raw);
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}
