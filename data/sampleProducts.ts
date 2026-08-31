// Centralized sample product data for the Lakupak Marketplace
export interface Product {
  id: string;
  name: string;
  description: string;
  sellingPrice: number;
  originalSellingPrice?: number;
  discount?: number;
  // Offer integration
  offerBadge?: 'Discount' | 'Promotion' | 'All Offers' | 'Offer';
  hasActiveOffer?: boolean;
  offerId?: string;
  offerName?: string;
  discountType?: 'percentage' | 'fixed' | 'buy_x_get_y';
  discountValue?: number; // The actual discount amount (for fixed) or percentage (for percentage)
  promotionDetails?: {
    minQuantity: number;
    freeQuantity: number;
    description: string;
  };
  rating: number;
  reviewCount: number;
  soldCount: string;
  stock: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  images: string[];
  category: string;
  productCategory: string;
  brand: string;
  unit: string;
  packageType: string;
  piecesPerPackage: number;
  seller: {
    name: string;
    avatar: string;
    rating: number;
    reviewCount: number;
    isOfficial: boolean;
    responseTime: string;
    deliverySpeed: string;
    returnPolicy: string;
  };
  shipping: {
    selfPickup: { available: boolean };
    sellerDelivery: { available: boolean };
    buyerCourier: { available: boolean };
  };
  assurance: {
    halalCertified: boolean;
    bpomApproved: boolean;
    returnPolicyDays: number;
    originalProduct: boolean;
  };
  reviews: {
    overallRating: number;
    totalReviews: number;
    breakdown: { [key: number]: number };
    sampleReview: {
      user: string;
      avatar: string;
      rating: number;
      comment: string;
      date: string;
    };
  };
  badges?: string[];
  isPreferred?: boolean;
  paymentOptions?: string;
  shippingInfo?: {
    days: string;
    location: string;
  };
}

export const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 17 Pro - Latest Premium Smartphone with Advanced Camera System',
    description: 'Experience the future of mobile technology with the iPhone 17 Pro. Featuring an advanced triple-camera system, A18 Pro chip, and stunning titanium design.',
    sellingPrice: 1749000,
    originalSellingPrice: 1999000,
    discount: 12,
    // Offer integration
    offerBadge: 'Discount',
    hasActiveOffer: true,
    offerId: 'OFF-123',
    offerName: 'Flash Sale - 12% Off',
    rating: 4.8,
    reviewCount: 127,
    soldCount: '2.5rb+',
    stock: 150,
    stockStatus: 'In Stock' as const,
    images: [
      'https://via.placeholder.com/400x250/FF6B35/FFFFFF?text=iPhone+17+Pro',
      'https://via.placeholder.com/400x250/FF6B35/FFFFFF?text=Back+View',
      'https://via.placeholder.com/400x250/FF6B35/FFFFFF?text=Side+View',
    ],
    category: 'Electronics',
    productCategory: 'Smartphones',
    brand: 'Apple',
    unit: 'pcs',
    packageType: 'Carton',
    piecesPerPackage: 10,
    seller: {
      name: 'Lakupak Official Store',
      avatar: 'L',
      rating: 4.9,
      reviewCount: 2100,
      isOfficial: true,
      responseTime: '1-2 hours',
      deliverySpeed: '1-3 days',
      returnPolicy: '7 days',
    },
    shipping: {
      selfPickup: { available: true },
      sellerDelivery: { available: true },
      buyerCourier: { available: true },
    },
    assurance: {
      halalCertified: false,
      bpomApproved: false,
      returnPolicyDays: 7,
      originalProduct: true,
    },
    reviews: {
      overallRating: 4.8,
      totalReviews: 127,
      breakdown: { 5: 102, 4: 19, 3: 4, 2: 1, 1: 1 },
      sampleReview: {
        user: 'John Doe',
        avatar: 'JD',
        rating: 5,
        comment: 'Excellent product quality! Fast delivery and great customer service. Highly recommended!',
        date: '2 days ago',
      },
    },
    badges: ['FREE SHIPPING', 'CASHBACK', 'VOUCHERS'],
    isPreferred: true,
    paymentOptions: 'SPayLater 0% 3x',
  },
  {
    id: '2',
    name: 'UCL Football Munich 2025 Final - Official Size 5 Match Ball',
    description: 'Official UEFA Champions League match ball for the 2025 final in Munich. Perfect for professional play and training.',
    sellingPrice: 350000,
    rating: 4.9,
    reviewCount: 22,
    soldCount: '22 sold',
    stock: 50,
    stockStatus: 'In Stock' as const,
    images: [
      'https://via.placeholder.com/400x250/10B981/FFFFFF?text=UCL+Football',
    ],
    category: 'Sports & Recreation',
    productCategory: 'Football',
    brand: 'Adidas',
    unit: 'pcs',
    packageType: 'Box',
    piecesPerPackage: 12,
    seller: {
      name: 'Sports World Store',
      avatar: 'S',
      rating: 4.7,
      reviewCount: 850,
      isOfficial: false,
      responseTime: '2-4 hours',
      deliverySpeed: '3-5 days',
      returnPolicy: '14 days',
    },
    shipping: {
      selfPickup: { available: true },
      sellerDelivery: { available: true },
      buyerCourier: { available: false },
    },
    assurance: {
      halalCertified: false,
      bpomApproved: false,
      returnPolicyDays: 14,
      originalProduct: true,
    },
    reviews: {
      overallRating: 4.9,
      totalReviews: 22,
      breakdown: { 5: 18, 4: 3, 3: 1, 2: 0, 1: 0 },
      sampleReview: {
        user: 'Mike Wilson',
        avatar: 'MW',
        rating: 5,
        comment: 'Great quality ball, exactly as described. Fast shipping!',
        date: '1 week ago',
      },
    },
    badges: ['FREE SHIPPING', 'CASHBACK', 'VOUCHERS'],
    isPreferred: true,
    shippingInfo: {
      days: '3-5 Days',
      location: 'Malaysia',
    },
  },
  {
    id: '3',
    name: 'Xiaomi Redmi TWS Wireless Earphones with Freebies - Bluetooth 5.0',
    description: 'High-quality wireless earphones with active noise cancellation, 30-hour battery life, and premium sound quality.',
    sellingPrice: 299000,
    originalSellingPrice: 999000,
    discount: 70,
    // Offer integration
    offerBadge: 'Promotion',
    hasActiveOffer: true,
    offerId: 'OFF-456',
    offerName: 'Buy 2 Get 1 Free',
    rating: 4.6,
    reviewCount: 592,
    soldCount: '592 sold',
    stock: 200,
    stockStatus: 'In Stock' as const,
    images: [
      'https://via.placeholder.com/400x250/6366F1/FFFFFF?text=Xiaomi+TWS',
    ],
    category: 'Electronics',
    productCategory: 'Audio',
    brand: 'Xiaomi',
    unit: 'set',
    packageType: 'Case',
    piecesPerPackage: 6,
    seller: {
      name: 'Tech Gadgets Store',
      avatar: 'T',
      rating: 4.5,
      reviewCount: 1200,
      isOfficial: true,
      responseTime: '1-3 hours',
      deliverySpeed: '2-4 days',
      returnPolicy: '7 days',
    },
    shipping: {
      selfPickup: { available: true },
      sellerDelivery: { available: true },
      buyerCourier: { available: true },
    },
    assurance: {
      halalCertified: false,
      bpomApproved: true,
      returnPolicyDays: 7,
      originalProduct: true,
    },
    reviews: {
      overallRating: 4.6,
      totalReviews: 592,
      breakdown: { 5: 420, 4: 120, 3: 35, 2: 12, 1: 5 },
      sampleReview: {
        user: 'Sarah Lee',
        avatar: 'SL',
        rating: 4,
        comment: 'Good sound quality for the price. Battery life is excellent.',
        date: '3 days ago',
      },
    },
    badges: ['FREE SHIPPING', 'CASHBACK', 'VOUCHERS'],
    isPreferred: true,
    shippingInfo: {
      days: '3-5 Days',
      location: 'Mainland China',
    },
  },
  {
    id: '4',
    name: 'HUGO Motivational Drinking Bottle Set 2 in 1 - 1000ML & 2000ML Water Bottles',
    description: 'Premium motivational water bottle set with measurement markings. Perfect for fitness enthusiasts and health-conscious individuals.',
    sellingPrice: 85000,
    originalSellingPrice: 259000,
    discount: 67,
    rating: 4.8,
    reviewCount: 47,
    soldCount: '47 sold',
    stock: 100,
    stockStatus: 'In Stock' as const,
    images: [
      'https://via.placeholder.com/400x250/06B6D4/FFFFFF?text=HUGO+Bottles',
    ],
    category: 'Health & Wellness',
    productCategory: 'Water Bottles',
    brand: 'HUGO',
    unit: 'set',
    packageType: 'Pack',
    piecesPerPackage: 24,
    seller: {
      name: 'Health Store Indonesia',
      avatar: 'H',
      rating: 4.8,
      reviewCount: 340,
      isOfficial: false,
      responseTime: '2-3 hours',
      deliverySpeed: '4-5 days',
      returnPolicy: '7 days',
    },
    shipping: {
      selfPickup: { available: false },
      sellerDelivery: { available: true },
      buyerCourier: { available: true },
    },
    assurance: {
      halalCertified: true,
      bpomApproved: true,
      returnPolicyDays: 7,
      originalProduct: true,
    },
    reviews: {
      overallRating: 4.8,
      totalReviews: 47,
      breakdown: { 5: 38, 4: 7, 3: 2, 2: 0, 1: 0 },
      sampleReview: {
        user: 'David Chen',
        avatar: 'DC',
        rating: 5,
        comment: 'Great quality bottles, motivational quotes are inspiring!',
        date: '5 days ago',
      },
    },
    badges: ['FREE SHIPPING', 'CASHBACK', 'VOUCHERS', 'PRAKTIS', 'BIG VOLUME'],
    isPreferred: true,
    paymentOptions: 'SPayLater 0% 3x',
    shippingInfo: {
      days: '4-5 Days',
      location: 'Indonesia',
    },
  },
];
