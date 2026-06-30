import i18n from '../i18n';

function normTerm(value: string): string {
  return value.trim().toLowerCase().normalize('NFC');
}

type ProductTypeEntry = { key: string; en: string; id: string };

function getProductTypeEntries(): ProductTypeEntry[] {
  const enMap = i18n.getFixedT('en')('productTypes', { returnObjects: true }) as Record<string, string>;
  const idMap = i18n.getFixedT('id')('productTypes', { returnObjects: true }) as Record<string, string>;
  const keys = new Set([...Object.keys(enMap), ...Object.keys(idMap)]);

  return Array.from(keys).map((key) => ({
    key,
    en: enMap[key] ?? key,
    id: idMap[key] ?? enMap[key] ?? key,
  }));
}

/** Map a user-facing category label (any locale) to the canonical English DB product type. */
export function resolveProductTypeKey(input: string): string | null {
  const q = normTerm(input);
  if (!q) return null;

  const entries = getProductTypeEntries();

  for (const { key, en, id } of entries) {
    if (normTerm(key) === q || normTerm(en) === q || normTerm(id) === q) {
      return key;
    }
  }

  let bestKey: string | null = null;
  let bestScore = -1;
  const consider = (key: string, label: string, baseScore: number) => {
    const l = normTerm(label);
    if (!l) return;

    let score = -1;
    if (l === q) score = baseScore + 200;
    else if (l.includes(q)) score = baseScore + 120 - l.length + q.length * 2;
    else if (q.includes(l) && l.length >= 3) score = baseScore + 90;
    else {
      const tokens = l.split(/[\s&]+/).filter(Boolean);
      if (tokens.some((t) => t === q || (q.length >= 4 && t.startsWith(q)) || (t.length >= 4 && q.startsWith(t)))) {
        score = baseScore + 100;
      }
    }

    if (score >= 0 && score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  };

  for (const { key, en, id } of entries) {
    consider(key, key, 50);
    consider(key, en, 60);
    consider(key, id, 75);
  }

  return bestKey;
}

/** Whether a canonical product type matches a lowercased query (English key or localized label). */
export function productTypeMatchesQuery(categoryKey: string, queryLower: string): boolean {
  const q = normTerm(queryLower);
  if (!q) return false;

  const key = categoryKey.trim();
  if (!key) return false;
  if (normTerm(key).includes(q)) return true;

  const enMap = i18n.getFixedT('en')('productTypes', { returnObjects: true }) as Record<string, string>;
  const idMap = i18n.getFixedT('id')('productTypes', { returnObjects: true }) as Record<string, string>;
  const labels = [enMap[key], idMap[key]].filter(Boolean);
  return labels.some((label) => normTerm(label).includes(q));
}

export function resolveSearchQuery(raw: string): {
  displayQuery: string;
  apiQuery: string;
  category?: string;
} {
  const displayQuery = raw.trim();
  if (!displayQuery) {
    return { displayQuery: '', apiQuery: '' };
  }

  const productTypeKey = resolveProductTypeKey(displayQuery);
  if (productTypeKey) {
    return {
      displayQuery,
      apiQuery: productTypeKey,
      category: productTypeKey,
    };
  }

  return { displayQuery, apiQuery: displayQuery };
}
