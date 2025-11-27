import { trackAsync, logError } from './monitoring'
import { graphqlRequest, decodeToken } from './graphql'

export type MobileUser = {
  id: number
  username?: string | null
  name?: string | null
  storeName?: string | null
  email?: string | null
  bio?: string | null
  phone?: string | null
  image?: string | null
  bannerImage?: string | null
  chosenAddress?: string | null
  country?: string | null
}

interface MarketplaceUserResponse {
  marketplaceUser: MobileUser
}

interface UpdateMarketplaceUserResponse {
  updateMarketplaceUser: MobileUser
}

export async function getMe(token: string, userId?: number) {
  return trackAsync('getMe', async () => {
    try {
      // Extract userId from token if not provided
      const decodedUserId = userId || decodeToken(token).userId;
      if (!decodedUserId) {
        throw new Error('Unable to extract userId from token');
      }
      
      const query = `
        query GetMarketplaceUser($userId: Int!) {
          marketplaceUser(userId: $userId) {
            id
            username
            name
            storeName
            email
            bio
            phone
            image
            bannerImage
            chosenAddress
            country
            createdAt
            updatedAt
          }
        }
      `;
      
      const result = await graphqlRequest<MarketplaceUserResponse>(
        query,
        { userId: decodedUserId },
        token
      );
      
      return result.marketplaceUser;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch user';
      logError('Failed to fetch user profile', { error: msg });
      throw new Error(msg);
    }
  });
}

export async function updateMe(
  token: string,
  data: {
    username?: string
    name?: string
    storeName?: string
    email?: string
    bio?: string
    phone?: string
    image?: string
    bannerImage?: string
    chosenAddress?: string
    country?: string
  },
  userId?: number
) {
  return trackAsync('updateMe', async () => {
    try {
      const resolvedUserId = userId || decodeToken(token).userId;
      if (!resolvedUserId) {
        throw new Error('Unable to extract userId from token');
      }

      const query = `
        mutation UpdateMarketplaceUser($userId: Int!, $input: UpdateMarketplaceUserInput!) {
          updateMarketplaceUser(userId: $userId, input: $input) {
            id
            username
            name
            storeName
            email
            bio
            phone
            image
            bannerImage
            chosenAddress
            country
            createdAt
            updatedAt
          }
        }
      `;

      const result = await graphqlRequest<UpdateMarketplaceUserResponse>(
        query,
        { userId: resolvedUserId, input: data },
        token,
      );
      
      return result.updateMarketplaceUser;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update user';
      logError('Failed to update user profile', { error: msg, data });
      throw new Error(msg);
    }
  });
}


