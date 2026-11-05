import { graphqlRequest } from './graphql';
import { API_BASE_URL, API_CONFIG } from './config';
import { hideUnreleasedBuyerOffers } from '../utils/orderPricingDisplay';

export interface OrderItem {
  productId?: string | null;
  productName?: string;
  category?: string;
  brand?: string;
  description?: string;
  images?: string[];
  productDeleted?: boolean;
  packageQuantity?: number;
  packageType?: string;
  piecesPerPackage?: number;
  pricePerPackage?: number;
  subtotal: number;
  variantId?: number;
  variantOptionId?: number;
  offerApplied?: boolean;
  offerBadgeSnapshot?: string;
  offerNameSnapshot?: string;
  promotionDetailsSnapshot?: string;
  variantNameSnapshot?: string;
    productNameSnapshot?: string;
    productSkuSnapshot?: string;
    productTypeSnapshot?: string;
    originalPriceSnapshot?: number;
    discountPercentage?: number;
    discountAmount?: number;
  moqSnapshot?: number;
  product?: {
    userId?: number | null;
    name?: string | null;
  } | null;
}

export interface Order {
  id?: string;
  orderId: string;
  buyerId?: string;
  userId?: number;
  orderStatus: string;
  paymentStatus: string;
  deliveryMethod?: string;
  deliveryOption?: string;
  shippingMethodLabel?: string;
  shippingMethod?: string;
  subtotal: number;
  discounts: number;
  shippingFee?: number;
  totalAmount: number;
  paymentTerms?: string;
  totalOrders?: number;
  contactPerson?: string;
  storeName?: string;
  contactPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  preferredDeliveryDate?: string;
  preferredDeliveryTime?: string;
  preferredPickupDate?: string;
  preferredPickupTime?: string;
  assignedLogistics?: string;
  trackingNumber?: string;
  deliveryNote?: string;
  deliveryConfirmation?: string;
  pod?: string;
  orderDate: string;
  pricingSentAt?: string | Date | null;
  createdAt?: string;
  updatedAt?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  returnItemsReceivedAt?: string | null;
  returnCollectedAt?: string | null;
  buyer?: {
    buyerId?: string;
    storeName?: string;
    owner?: string;
    email?: string;
    phone?: string;
  };
  seller?: {
    name?: string | null;
    companyName?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    shippingPreferences?: string | null;
    logo?: string | null;
    bannerImage?: string | null;
  } | null;
  orderItems: OrderItem[];
  returnRequests?: {
    id: number;
    orderId: string;
    marketplaceUserId: number;
    reason: string;
    reasonDetail?: string | null;
    imageUrls: string[];
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  }[];
}

interface MobileOrdersResponse {
  mobileOrders: {
    nodes: Order[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
}

interface CreateMobileOrderResponse {
  createMobileOrder: Order;
}

class OrdersService {
  async getOrders(
    userId: number,
    page: number = 1,
    limit: number = 10,
    token?: string
  ): Promise<{ orders: Order[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
    try {
      // Prefer REST (same as Marketplace-Web) — does not re-apply catalog prices on read.
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/mobile/orders?userId=${userId}&page=${page}&limit=${limit}`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              signal: controller.signal,
            },
          );
          if (response.ok) {
            const data = await response.json();
            const orders = hideUnreleasedBuyerOffers((data.orders ?? []) as Order[]);
            return {
              orders,
              pagination: {
                page: data.pagination?.page ?? page,
                limit: data.pagination?.limit ?? limit,
                totalCount: data.pagination?.total ?? orders.length,
                totalPages: data.pagination?.pages ?? 1,
              },
            };
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch {
        // fall through to GraphQL
      }

      const query = `
        query GetMobileOrders($userId: Int!, $page: Int!, $limit: Int!) {
          mobileOrders(userId: $userId, page: $page, limit: $limit) {
            nodes {
              id
              orderId
              buyerId
              userId
              orderStatus
              paymentStatus
              deliveryMethod
              deliveryOption
              shippingMethodLabel
              shippingMethod
              subtotal
              discounts
              shippingFee
              totalAmount
              paymentTerms
              totalOrders
              contactPerson
              storeName
              contactPhone
              customerEmail
              deliveryAddress
              preferredDeliveryDate
              preferredDeliveryTime
              preferredPickupDate
              preferredPickupTime
              assignedLogistics
              trackingNumber
              deliveryNote
              deliveryConfirmation
              pod
              orderDate
              pricingSentAt
              createdAt
              updatedAt
              acceptedBy
              acceptedAt
              returnItemsReceivedAt
              returnCollectedAt
              buyer {
                buyerId
                storeName
                owner
                email
                phone
              }
              seller {
                name
                companyName
                companyAddress
                companyPhone
                companyEmail
                shippingPreferences
                logo
                bannerImage
              }
              orderItems {
                productId
                productName
                category
                brand
                description
                images
                productDeleted
                packageQuantity
                packageType
                piecesPerPackage
                pricePerPackage
                subtotal
                variantId
                variantOptionId
                offerApplied
                offerBadgeSnapshot
                offerNameSnapshot
                promotionDetailsSnapshot
                variantNameSnapshot
                productNameSnapshot
                productSkuSnapshot
                productTypeSnapshot
                originalPriceSnapshot
                discountPercentage
                discountAmount
                moqSnapshot
              }
              returnRequests {
                id
                orderId
                marketplaceUserId
                reason
                reasonDetail
                imageUrls
                status
                createdAt
                updatedAt
              }
            }
            pagination {
              page
              limit
              totalCount
              totalPages
            }
          }
        }
      `;
      
      const result = await graphqlRequest<MobileOrdersResponse>(
        query,
        { userId, page, limit },
        token
      );
      
      return {
        orders: hideUnreleasedBuyerOffers(result.mobileOrders.nodes),
        pagination: result.mobileOrders.pagination,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to load orders');
    }
  }

  /** Buyer order detail — never use Dashboard /api/orders (that syncs catalog into Pending POs). */
  async getOrderById(
    orderId: string,
    userId: number,
    token?: string
  ): Promise<Order | null> {
    // No single-order buyer endpoint. List pages are capped at 100, so walk them.
    const limit = 100;
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const { orders, pagination } = await this.getOrders(userId, page, limit, token);
      const match = orders.find((order) => order.orderId === orderId);
      if (match) return match;

      const reportedPages = pagination.totalPages;
      totalPages = Number.isFinite(reportedPages) && reportedPages > 0 ? reportedPages : page;
      if (orders.length < limit) break;
      page += 1;
    }

    return null;
  }

  async createOrder(
    userId: number,
    orderData: {
      orderId: string;
      orderDate?: string;
      distributorUserId?: number;
      orderItems: Array<Record<string, unknown>>;
      subtotal: number;
      discounts?: number;
      shippingFee: number;
      totalAmount: number;
      totalOrders?: number;
      contactPerson?: string;
      storeName?: string;
      contactPhone?: string;
      customerEmail?: string;
      deliveryAddress?: string;
      deliveryMethod?: string;
      deliveryOption?: string;
      orderStatus?: string;
      paymentStatus?: string;
      paymentTerms?: string;
      preferredDeliveryDate?: string;
      preferredDeliveryTime?: string;
      preferredPickupDate?: string;
      preferredPickupTime?: string;
      shippingMethodLabel?: string;
      shippingMethod?: string;
    },
    token?: string
  ): Promise<Order> {
    try {
      // Use REST endpoint for order creation (aligned with architecture: REST for mutations)
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...orderData,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create order' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to create order`);
      }

      const result = await response.json();
      return result.order || result; // Handle both single order and array response
    } catch (error) {
      throw error;
    }
  }

  async updateOrderDetails(
    userId: number,
    orderData: {
      orderId: string;
      contactPerson: string;
      contactPhone: string;
      storeName: string;
      deliveryAddress: string;
      deliveryOption: 'self_pickup' | 'seller_delivery' | 'buyer_courier';
      paymentMethod: 'cod' | 'bank_transfer';
    },
    token?: string,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/mobile/orders`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...orderData, userId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update order' }));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to update order`);
    }
  }
}

export const ordersService = new OrdersService();

