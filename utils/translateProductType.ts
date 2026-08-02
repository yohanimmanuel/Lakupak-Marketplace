import i18n from '../i18n';
import { canonicalizeCategory } from './categoryUtils';

/** Display label for predefined product types (DB values stay English). */
export function translateProductType(value: string | undefined | null): string {
  const v = canonicalizeCategory(value);
  if (!v) return (value ?? '').trim();

  const map = i18n.t('productTypes', { returnObjects: true });
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    const label = (map as Record<string, string>)[v];
    if (typeof label === 'string' && label.length > 0) return label;
  }

  return v;
}
