import { MarketplaceProduct } from '../services/marketplace';

/** Legacy single-word / room-level productType values → new taxonomy. */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'Food & Beverage': 'Food & Beverages',
  Technology: 'Mobile & Gadgets',
  Fashion: 'Fashion & Apparel',
  'Bags & Wallets': 'Bags & Wallets',
  'Home & Garden': 'Home & Living',
  Sports: 'Sports & Outdoors',
  Beauty: 'Beauty & Personal Care',
  Books: 'Hobbies & Books',
  Automotive: 'Automotive & Motorbike',
  Health: 'Health & Wellness',
  Toys: 'Toys, Kids & Babies',
  Office: 'Office & Stationery',
  Garden: 'Home & Living',
  Jewelry: 'Jewelry & Accessories',
  Music: 'Music & Audio',
  Pets: 'Pet Supplies',
  Travel: 'Travel & Luggage',
  Art: 'Hobbies & Books',
  Photography: 'Cameras & Drones',
  Gaming: 'Video Games',
  Furniture: 'Home & Living',
  Tools: 'Tools & Hardware',
  Baby: 'Toys, Kids & Babies',
  Outdoor: 'Sports & Outdoors',
  Kitchen: 'Home Appliances',
  Bathroom: 'Home & Living',
  Bedroom: 'Home & Living',
  'Living Room': 'Home & Living',
  Dining: 'Home & Living',
  Storage: 'Home & Living',
  Lighting: 'Home & Living',
  Decor: 'Home & Living',
  Appliances: 'Home Appliances',
  Cleaning: 'Household Supplies',
  Organization: 'Office & Stationery',
  Safety: 'Tools & Hardware',
};

export function canonicalizeCategory(value: string | null | undefined): string {
  const key = (value ?? '').trim();
  if (!key) return '';
  return LEGACY_CATEGORY_MAP[key] ?? key;
}

// Category icon mapping (Ionicons-style names used by CategoryBadge)
const categoryIconMap: { [key: string]: string } = {
  'Food & Beverages': 'restaurant',
  'Fresh Produce': 'nutrition',
  'Mobile & Gadgets': 'phone-portrait',
  'Computers & Peripherals': 'laptop',
  'Home Appliances': 'hardware-chip',
  "Men's Wear": 'shirt',
  "Women's Apparel": 'sparkles',
  "Men's Shoes": 'footsteps',
  "Women's Shoes": 'footsteps',
  "Men's Bags": 'briefcase',
  "Women's Bags": 'bag-handle',
  'Kids Fashion': 'happy',
  'Sports & Outdoors': 'fitness',
  'Beauty & Personal Care': 'flower',
  'Health & Wellness': 'medical',
  'Pharmacy & Medical': 'medkit',
  'Home & Living': 'home',
  'Household Supplies': 'water',
  'Toys, Kids & Babies': 'happy',
  'Mom & Baby Care': 'heart',
  'Pet Supplies': 'paw',
  'Automotive & Motorbike': 'car',
  'Tools & Hardware': 'construct',
  'Office & Stationery': 'briefcase',
  'Cameras & Drones': 'camera',
  'Video Games': 'game-controller',
  'Hobbies & Books': 'book',
  'Jewelry & Accessories': 'diamond',
  Watches: 'time',
  'Music & Audio': 'musical-notes',
  'Travel & Luggage': 'airplane',
  Miscellaneous: 'apps',
  Default: 'grid',
};

const categoryColorMap: { [key: string]: string } = {
  'Food & Beverages': '#84CC16',
  'Fresh Produce': '#65A30D',
  'Mobile & Gadgets': '#3B82F6',
  'Computers & Peripherals': '#2563EB',
  'Home Appliances': '#374151',
  "Men's Wear": '#2563EB',
  "Women's Apparel": '#EC4899',
  "Men's Shoes": '#1D4ED8',
  "Women's Shoes": '#DB2777',
  "Men's Bags": '#B45309',
  "Women's Bags": '#C2410C',
  'Kids Fashion': '#F59E0B',
  'Sports & Outdoors': '#F59E0B',
  'Beauty & Personal Care': '#8B5CF6',
  'Health & Wellness': '#EC4899',
  'Pharmacy & Medical': '#DC2626',
  'Home & Living': '#10B981',
  'Household Supplies': '#0EA5E9',
  'Toys, Kids & Babies': '#FBBF24',
  'Mom & Baby Care': '#F472B6',
  'Pet Supplies': '#F97316',
  'Automotive & Motorbike': '#374151',
  'Tools & Hardware': '#6B7280',
  'Office & Stationery': '#6366F1',
  'Cameras & Drones': '#6B7280',
  'Video Games': '#8B5CF6',
  'Hobbies & Books': '#6B7280',
  'Jewelry & Accessories': '#F59E0B',
  Watches: '#0F172A',
  'Music & Audio': '#8B5CF6',
  'Travel & Luggage': '#06B6D4',
  Miscellaneous: '#94A3B8',
  Default: '#6B7280',
};

export interface DynamicCategory {
  name: string;
  icon: string;
  color: string;
  count: number;
}

export const generateDynamicCategories = (products: MarketplaceProduct[]): DynamicCategory[] => {
  const categoryCounts: { [key: string]: number } = {};

  products.forEach((product) => {
    const category = canonicalizeCategory(product.category || 'General');
    if (category && category !== 'Uncategorized' && category !== 'General') {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  });

  if (Object.keys(categoryCounts).length === 0) {
    categoryCounts['General'] = products.length;
  }

  return Object.entries(categoryCounts)
    .map(([name, count]) => ({
      name,
      count,
      icon: categoryIconMap[name] || categoryIconMap.Default,
      color: categoryColorMap[name] || categoryColorMap.Default,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
};

/**
 * Full category directory for home / categories / search discovery.
 * Always shows every predefined category (not filtered by published products).
 * Live counts are filled when products are available.
 */
export const buildCategoryDirectory = (
  products: MarketplaceProduct[] = [],
): DynamicCategory[] => {
  const counts = new Map<string, number>();
  for (const product of products) {
    const category = canonicalizeCategory(product.category);
    if (!category || category === 'Uncategorized' || category === 'General') continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return PREDEFINED_CATEGORY_NAMES.map((name) => ({
    name,
    count: counts.get(name) ?? 0,
    icon: categoryIconMap[name] || categoryIconMap.Default,
    color: categoryColorMap[name] || categoryColorMap.Default,
  }));
};

export const getCategoryIcon = (categoryName: string): string => {
  return categoryIconMap[canonicalizeCategory(categoryName)] || categoryIconMap.Default;
};

/** Local pictorial assets (require() so Metro bundles them). */
const categoryImageMap: Record<string, number> = {
  'Food & Beverages': require('../assets/categories/foodnbeverage.png'),
  'Fresh Produce': require('../assets/categories/freshproduce.png'),
  'Mobile & Gadgets': require('../assets/categories/mobilegadgets.png'),
  'Computers & Peripherals': require('../assets/categories/computerperipherals.png'),
  'Home Appliances': require('../assets/categories/homeappliances.png'),
  "Men's Wear": require('../assets/categories/menswear.png'),
  "Women's Apparel": require('../assets/categories/womensapparel.png'),
  "Men's Shoes": require('../assets/categories/menshoes.png'),
  "Women's Shoes": require('../assets/categories/womenshoes.png'),
  "Men's Bags": require('../assets/categories/mensbag.png'),
  "Women's Bags": require('../assets/categories/womensbag.png'),
  'Kids Fashion': require('../assets/categories/kidsfashion.png'),
  'Sports & Outdoors': require('../assets/categories/sportsoutdoors.png'),
  'Beauty & Personal Care': require('../assets/categories/beautycare.png'),
  'Health & Wellness': require('../assets/categories/healthwellness.png'),
  'Pharmacy & Medical': require('../assets/categories/pharmacies.png'),
  'Home & Living': require('../assets/categories/homeliving.png'),
  'Household Supplies': require('../assets/categories/householdsupplies.png'),
  'Toys, Kids & Babies': require('../assets/categories/toys.png'),
  'Mom & Baby Care': require('../assets/categories/babycare.png'),
  'Pet Supplies': require('../assets/categories/petsupplies.png'),
  'Automotive & Motorbike': require('../assets/categories/automotive.png'),
  'Tools & Hardware': require('../assets/categories/toolshardware.png'),
  'Office & Stationery': require('../assets/categories/officestationaires.png'),
  'Cameras & Drones': require('../assets/categories/camerasdrones.png'),
  'Video Games': require('../assets/categories/videogames.png'),
  'Hobbies & Books': require('../assets/categories/hobbiesbooks.png'),
  'Jewelry & Accessories': require('../assets/categories/jeweleriesaccessories.png'),
  Watches: require('../assets/categories/watch.png'),
  'Music & Audio': require('../assets/categories/musicaudio.png'),
  'Travel & Luggage': require('../assets/categories/travelluggages.png'),
  Miscellaneous: require('../assets/categories/miscellaneous.png'),
};

export const getCategoryImageSource = (
  categoryName: string | null | undefined,
): number | null => {
  const key = canonicalizeCategory(categoryName);
  if (!key) return null;
  return categoryImageMap[key] ?? null;
};

export const getCategoryColor = (categoryName: string): string => {
  return categoryColorMap[canonicalizeCategory(categoryName)] || categoryColorMap.Default;
};

/** Stable list of predefined category English keys (search filters / directory). */
export const PREDEFINED_CATEGORY_NAMES: string[] = Object.keys(categoryIconMap).filter(
  (name) => name !== 'Default',
);

export interface TopBrand {
  name: string;
}

export const generateTopBrands = (products: MarketplaceProduct[]): TopBrand[] => {
  const brandCounts: { [key: string]: number } = {};

  products.forEach((product) => {
    const brand = product.brand?.trim();
    if (brand && brand !== '' && brand !== 'N/A' && brand !== 'Unknown') {
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  });

  return Object.entries(brandCounts)
    .map(([name]) => ({ name }))
    .sort((a, b) => brandCounts[b.name] - brandCounts[a.name])
    .slice(0, 8);
};

export interface TopDistributor {
  name: string;
  logo: string;
}

export const generateTopDistributors = (products: MarketplaceProduct[]): TopDistributor[] => {
  const distributorCounts: { [key: string]: { count: number; logo: string } } = {};

  products.forEach((product) => {
    const company = product.seller?.company;
    if (company && company.name && company.name.trim() !== '' && company.name !== 'N/A') {
      const distributorName = company.name.trim();
      if (!distributorCounts[distributorName]) {
        distributorCounts[distributorName] = {
          count: 0,
          logo: company.logo || '',
        };
      }
      distributorCounts[distributorName].count += 1;
      if (company.logo && !distributorCounts[distributorName].logo) {
        distributorCounts[distributorName].logo = company.logo;
      }
    }
  });

  return Object.entries(distributorCounts)
    .map(([name, data]) => ({
      name,
      logo: data.logo,
    }))
    .sort((a, b) => distributorCounts[b.name].count - distributorCounts[a.name].count)
    .slice(0, 8);
};
