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
  userId: number,
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
  }
) {
  return trackAsync('updateMe', async () => {
    try {
      const query = `
        mutation UpdateMarketplaceUser(
          $userId: Int!
          $username: String
          $name: String
          $storeName: String
          $email: String
          $bio: String
          $phone: String
          $image: String
          $bannerImage: String
          $chosenAddress: String
          $country: String
        ) {
          updateMarketplaceUser(
            userId: $userId
            username: $username
            name: $name
            storeName: $storeName
            email: $email
            bio: $bio
            phone: $phone
            image: $image
            bannerImage: $bannerImage
            chosenAddress: $chosenAddress
            country: $country
          ) {
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
        { userId, ...data },
        token
      );
      
      return result.updateMarketplaceUser;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update user';
      logError('Failed to update user profile', { error: msg, data });
      throw new Error(msg);
    }
  });
}


