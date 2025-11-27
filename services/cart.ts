import { MarketplaceProduct } from './marketplace';
import { graphqlRequest } from './graphql';

export interface CartItem {
  id: number;
  userId: number;
  productId: string;
  productData: MarketplaceProduct;
  activityType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface CartConnectionResponse {
  mobileCart: {
    items: CartItem[];
    success: boolean;
  };
}

interface AddToCartResponse {
  addToCart: {
    success: boolean;
    cartItem: CartItem;
    message: string;
  };
}

interface UpdateCartItemResponse {
  updateCartItem: {
    success: boolean;
    cartItem: CartItem;
    message: string;
  };
}

interface RemoveCartItemResponse {
  removeCartItem: {
    success: boolean;
    cartItem: CartItem | null;
    message: string;
  };
}

interface ClearCartResponse {
  clearCart: {
    success: boolean;
    cartItem: CartItem | null;
    message: string;
  };
}

class CartService {
  async getCart(userId: number, token?: string): Promise<CartItem[]> {
    try {
      const query = `
        query GetMobileCart($userId: Int!) {
          mobileCart(userId: $userId) {
            items {
              id
              userId
              productId
              productData
              activityType
              metadata
              createdAt
              updatedAt
            }
            success
          }
        }
      `;
      
      const result = await graphqlRequest<CartConnectionResponse>(
        query,
        { userId },
        token
      );
      
      return result.mobileCart.items || [];
    } catch (error) {
      return [];
    }
  }

  async addToCart(
    userId: number,
    productId: string,
    productData: MarketplaceProduct,
    quantity?: number,
    variant?: string,
    token?: string
  ): Promise<CartItem> {
    try {
      const query = `
        mutation AddToCart(
          $userId: Int!
          $productId: String!
          $productData: JSONObject!
          $quantity: Int
          $variant: String
        ) {
          addToCart(
            input: {
              userId: $userId
              productId: $productId
              productData: $productData
              quantity: $quantity
              variant: $variant
            }
          ) {
            success
            cartItem {
              id
              userId
              productId
              productData
              activityType
              metadata
              createdAt
              updatedAt
            }
            message
          }
        }
      `;
      
      const result = await graphqlRequest<AddToCartResponse>(
        query,
        {
          userId,
          productId,
          productData,
          quantity,
          variant,
        },
        token
      );
      
      if (!result.addToCart.success || !result.addToCart.cartItem) {
        throw new Error(result.addToCart.message || 'Failed to add item to cart');
      }
      
      return result.addToCart.cartItem;
    } catch (error) {
      throw error;
    }
  }

  async updateCartItem(
    cartItemId: number,
    quantity?: number,
    selected?: boolean,
    token?: string
  ): Promise<CartItem> {
    try {
      const query = `
        mutation UpdateCartItem(
          $cartItemId: Int!
          $quantity: Int
          $selected: Boolean
        ) {
          updateCartItem(
            input: {
              cartItemId: $cartItemId
              quantity: $quantity
              selected: $selected
            }
          ) {
            success
            cartItem {
              id
              userId
              productId
              productData
              activityType
              metadata
              createdAt
              updatedAt
            }
            message
          }
        }
      `;
      
      const result = await graphqlRequest<UpdateCartItemResponse>(
        query,
        {
          cartItemId,
          quantity,
          selected,
        },
        token
      );
      
      if (!result.updateCartItem.success || !result.updateCartItem.cartItem) {
        throw new Error(result.updateCartItem.message || 'Failed to update cart item');
      }
      
      return result.updateCartItem.cartItem;
    } catch (error) {
      throw error;
    }
  }

  async removeCartItem(cartItemId: number, token?: string): Promise<boolean> {
    try {
      const query = `
        mutation RemoveCartItem($cartItemId: Int!) {
          removeCartItem(cartItemId: $cartItemId) {
            success
            message
          }
        }
      `;
      
      const result = await graphqlRequest<RemoveCartItemResponse>(
        query,
        { cartItemId },
        token
      );
      
      return result.removeCartItem.success;
    } catch (error) {
      return false;
    }
  }

  async clearCart(userId: number, token?: string): Promise<boolean> {
    try {
      const query = `
        mutation ClearCart($userId: Int!) {
          clearCart(userId: $userId) {
            success
            message
          }
        }
      `;
      
      const result = await graphqlRequest<ClearCartResponse>(
        query,
        { userId },
        token
      );
      
      return result.clearCart.success;
    } catch (error) {
      return false;
    }
  }
}

export const cartService = new CartService();

