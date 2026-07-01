/** Clamp typed piece count to available stock (Shopee-style: reject overflow digits). */
export function clampPiecesToStock(
  rawDigits: string,
  stock: number,
): { display: string; parsed: number } {
  if (!rawDigits) return { display: '', parsed: 0 };

  let parsed = parseInt(rawDigits, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return { display: '', parsed: 0 };
  if (parsed > stock) parsed = stock;

  return { display: String(parsed), parsed };
}

export function piecesToLivePackageQuantity(
  parsed: number,
  piecesPerPackage: number,
  stock: number,
): number {
  if (parsed <= 0) return 0;
  const pp = Math.max(1, piecesPerPackage);
  const maxPackages = Math.max(1, Math.floor(stock / pp));
  return Math.min(Math.ceil(parsed / pp), maxPackages);
}

export function normalizeCommittedPieces(
  parsed: number,
  piecesPerPackage: number,
  stock: number,
  moq: number | null,
): { packages: number; pieces: number } {
  const pp = Math.max(1, piecesPerPackage);
  const minPackages = moq ? Math.ceil(moq / pp) : 1;
  const maxPackages = Math.max(1, Math.floor(stock / pp));
  const clampedPieces = Math.min(Math.max(parsed, 0), stock);
  const packages = Math.max(minPackages, Math.min(Math.ceil(clampedPieces / pp), maxPackages));
  return { packages, pieces: packages * pp };
}
