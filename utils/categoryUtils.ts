import { MarketplaceProduct } from '../services/marketplace';

// Category icon mapping
const categoryIconMap: { [key: string]: string } = {
  'Food & Beverage': 'restaurant-outline',
  'Technology': 'phone-portrait-outline',
  'Fashion': 'shirt-outline',
  'Home & Garden': 'home-outline',
  'Sports': 'fitness-outline',
  'Beauty': 'flower-outline',
  'Books': 'book-outline',
  'Automotive': 'car-outline',
  'Health': 'medical-outline',
  'Toys': 'game-controller-outline',
  'Office': 'briefcase-outline',
  'Garden': 'leaf-outline',
  'Jewelry': 'diamond-outline',
  'Music': 'musical-notes-outline',
  'Pets': 'paw-outline',
  'Travel': 'airplane-outline',
  'Art': 'color-palette-outline',
  'Photography': 'camera-outline',
  'Gaming': 'game-controller-outline',
  'Furniture': 'bed-outline',
  'Tools': 'construct-outline',
  'Baby': 'baby-outline',
  'Outdoor': 'bicycle-outline',
  'Kitchen': 'restaurant-outline',
  'Bathroom': 'water-outline',
  'Bedroom': 'bed-outline',
  'Living Room': 'tv-outline',
  'Dining': 'restaurant-outline',
  'Storage': 'archive-outline',
  'Lighting': 'bulb-outline',
  'Decor': 'flower-outline',
  'Appliances': 'hardware-chip-outline',
  'Cleaning': 'water-outline',
  'Organization': 'folder-outline',
  'Safety': 'shield-outline',
  'Default': 'grid-outline'
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
    const category = product.category || 'Uncategorized';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

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
