import { graphqlRequest } from './graphql';

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
  originalPriceSnapshot?: string;
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
  shippingFee: number;
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
  createdAt?: string;
  updatedAt?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  buyer?: {
    buyerId?: string;
    storeName?: string;
    owner?: string;
    email?: string;
    phone?: string;
  };
  seller?: Record<string, unknown>;
  orderItems: OrderItem[];
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
              createdAt
              updatedAt
              acceptedBy
              acceptedAt
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
        orders: result.mobileOrders.nodes,
        pagination: result.mobileOrders.pagination,
      };
    } catch (error) {
      return {
        orders: [],
        pagination: {
          page: 1,
          limit: 10,
          totalCount: 0,
          totalPages: 0,
        },
      };
    }
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
      const query = `
        mutation CreateMobileOrder(
          $userId: Int!
          $orderId: String!
          $orderDate: String
          $distributorUserId: Int
          $orderItems: [JSONObject!]!
          $subtotal: Float!
          $discounts: Float
          $shippingFee: Float!
          $totalAmount: Float!
          $totalOrders: Int
          $contactPerson: String
          $storeName: String
          $contactPhone: String
          $customerEmail: String
          $deliveryAddress: String
          $deliveryMethod: String
          $deliveryOption: String
          $orderStatus: String
          $paymentStatus: String
          $paymentTerms: String
          $preferredDeliveryDate: String
          $preferredDeliveryTime: String
          $preferredPickupDate: String
          $preferredPickupTime: String
          $shippingMethodLabel: String
          $shippingMethod: String
        ) {
          createMobileOrder(
            userId: $userId
            orderId: $orderId
            orderDate: $orderDate
            distributorUserId: $distributorUserId
            orderItems: $orderItems
            subtotal: $subtotal
            discounts: $discounts
            shippingFee: $shippingFee
            totalAmount: $totalAmount
            totalOrders: $totalOrders
            contactPerson: $contactPerson
            storeName: $storeName
            contactPhone: $contactPhone
            customerEmail: $customerEmail
            deliveryAddress: $deliveryAddress
            deliveryMethod: $deliveryMethod
            deliveryOption: $deliveryOption
            orderStatus: $orderStatus
            paymentStatus: $paymentStatus
            paymentTerms: $paymentTerms
            preferredDeliveryDate: $preferredDeliveryDate
            preferredDeliveryTime: $preferredDeliveryTime
            preferredPickupDate: $preferredPickupDate
            preferredPickupTime: $preferredPickupTime
            shippingMethodLabel: $shippingMethodLabel
            shippingMethod: $shippingMethod
          ) {
            id
            orderId
            buyerId
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
            createdAt
            updatedAt
            acceptedBy
            acceptedAt
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
              id
              orderId
              buyerId
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
              createdAt
              updatedAt
              acceptedBy
              acceptedAt
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
            }
          }
        }
      `;
      
      const result = await graphqlRequest<CreateMobileOrderResponse>(
        query,
        {
          userId,
          ...orderData,
        },
        token
      );
      
      return result.createMobileOrder;
    } catch (error) {
      throw error;
    }
  }
}

export const ordersService = new OrdersService();

