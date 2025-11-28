import { MarketplaceProduct } from '../services/marketplace';

// Category icon mapping (using filled icons)
const categoryIconMap: { [key: string]: string } = {
  'Food & Beverage': 'restaurant',
  'Technology': 'phone-portrait',
  'Fashion': 'shirt',
  'Home & Garden': 'home',
  'Sports': 'fitness',
  'Beauty': 'flower',
  'Books': 'book',
  'Automotive': 'car',
  'Health': 'medical',
  'Toys': 'game-controller',
  'Office': 'briefcase',
  'Garden': 'leaf',
  'Jewelry': 'diamond',
  'Music': 'musical-notes',
  'Pets': 'paw',
  'Travel': 'airplane',
  'Art': 'color-palette',
  'Photography': 'camera',
  'Gaming': 'game-controller',
  'Furniture': 'bed',
  'Tools': 'construct',
  'Baby': 'baby',
  'Outdoor': 'bicycle',
  'Kitchen': 'restaurant',
  'Bathroom': 'water',
  'Bedroom': 'bed',
  'Living Room': 'tv',
  'Dining': 'restaurant',
  'Storage': 'archive',
  'Lighting': 'bulb',
  'Decor': 'flower',
  'Appliances': 'hardware-chip',
  'Cleaning': 'water',
  'Organization': 'folder',
  'Safety': 'shield',
  'Default': 'grid'
};

// Category color mapping
const categoryColorMap: { [key: string]: string } = {
  'Electronics': '#3B82F6',
  'Fashion': '#EF4444',
  'Home & Garden': '#10B981',
  'Sports': '#F59E0B',
  'Beauty': '#8B5CF6',
  'Books': '#6B7280',
  'Automotive': '#374151',
  'Health': '#EC4899',
  'Toys': '#F97316',
  'Food': '#84CC16',
  'Office': '#6366F1',
  'Garden': '#22C55E',
  'Jewelry': '#F59E0B',
  'Music': '#8B5CF6',
  'Pets': '#F97316',
  'Travel': '#06B6D4',
  'Art': '#EC4899',
  'Photography': '#6B7280',
  'Gaming': '#8B5CF6',
  'Furniture': '#A78BFA',
  'Tools': '#6B7280',
  'Baby': '#FBBF24',
  'Outdoor': '#10B981',
  'Kitchen': '#F59E0B',
  'Bathroom': '#06B6D4',
  'Bedroom': '#8B5CF6',
  'Living Room': '#3B82F6',
  'Dining': '#F59E0B',
  'Storage': '#6B7280',
  'Lighting': '#FBBF24',
  'Decor': '#EC4899',
  'Appliances': '#374151',
  'Cleaning': '#06B6D4',
  'Organization': '#6366F1',
  'Safety': '#EF4444',
  'Default': '#6B7280'
};

export interface DynamicCategory {
  name: string;
  icon: string;
  color: string;
  count: number;
}

export const generateDynamicCategories = (products: MarketplaceProduct[]): DynamicCategory[] => {
  // Count products by category
  const categoryCounts: { [key: string]: number } = {};
  
  products.forEach(product => {
    const category = product.category || 'General';
    if (category && category !== 'Uncategorized' && category !== 'General') {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  });
  
  // If no categories found, add a default one
  if (Object.keys(categoryCounts).length === 0) {
    categoryCounts['General'] = products.length;
  }

  // Convert to array and sort by count (descending)
  const categories = Object.entries(categoryCounts)
    .map(([name, count]) => ({
      name,
      count,
      icon: categoryIconMap[name] || categoryIconMap['Default'],
      color: categoryColorMap[name] || categoryColorMap['Default']
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Limit to top 8 categories

  return categories;
};

export const getCategoryIcon = (categoryName: string): string => {
  return categoryIconMap[categoryName] || categoryIconMap['Default'];
};

export const getCategoryColor = (categoryName: string): string => {
  return categoryColorMap[categoryName] || categoryColorMap['Default'];
};
