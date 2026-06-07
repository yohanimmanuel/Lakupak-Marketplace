import { trackAsync, logError } from './monitoring'
import { graphqlRequest, decodeToken } from './graphql'
import { useAuthStore } from '../stores/authStore'

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

export type MobileAddress = {
  id: number
  userId: number
  fullName?: string | null
  phone?: string | null
  address?: string | null
  label?: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

type CreateAddressInput = {
  fullName: string
  phone: string
  address: string
  label?: string
  isDefault?: boolean
}

type UpdateAddressInput = {
  fullName?: string
  phone?: string
  address?: string
  label?: string
  isDefault?: boolean
}

const ADDRESS_FRAGMENT = `
  id
  userId
  fullName
  phone
  address
  label
  isDefault
  createdAt
  updatedAt
`

const resolveUserId = (token: string, explicit?: number) => {
  const userId = explicit || decodeToken(token).userId
  if (!userId) {
    throw new Error('Unable to extract userId from token')
  }
  return userId
}

interface MarketplaceUserResponse {
  marketplaceUser: MobileUser
}

interface UpdateMarketplaceUserResponse {
  updateMarketplaceUser: MobileUser
}

interface MarketplaceAddressListResponse {
  marketplaceAddresses: {
    success: boolean
    addresses: MobileAddress[]
  }
}

interface CreateMarketplaceAddressResponse {
  createMarketplaceAddress: {
    success: boolean
    message?: string | null
    address?: MobileAddress | null
  }
}

interface UpdateMarketplaceAddressResponse {
  updateMarketplaceAddress: {
    success: boolean
    message?: string | null
    address?: MobileAddress | null
  }
}

interface DeleteMarketplaceAddressResponse {
  deleteMarketplaceAddress: {
    success: boolean
    message?: string | null
    address?: MobileAddress | null
  }
}

export async function getMe(token: string, userId?: number) {
  return trackAsync('getMe', async () => {
    try {
      const decodedUserId = resolveUserId(token, userId)
      
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
      
      if (!result.marketplaceUser) {
        throw new Error('User not found');
      }

      return result.marketplaceUser;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch user';
      const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
      if (code === 'ACCOUNT_SUSPENDED' || msg.includes('ACCOUNT_SUSPENDED')) {
        const reason =
          (error instanceof Error ? (error as Error & { reason?: string | null }).reason : null) ?? null;
        // Do not overwrite the reason with the code; prefer backend-provided suspension reason.
        useAuthStore.getState().setSuspension(true, reason);
        const err = new Error('ACCOUNT_SUSPENDED') as Error & { code?: string; reason?: string | null };
        err.code = 'ACCOUNT_SUSPENDED';
        err.reason = reason;
        throw err;
      }
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
      const resolvedUserId = resolveUserId(token, userId)

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

export async function getMarketplaceAddresses(token: string, userId?: number) {
  return trackAsync('getMarketplaceAddresses', async () => {
    try {
      const resolvedUserId = resolveUserId(token, userId)
      const query = `
        query MarketplaceAddresses($userId: Int!) {
          marketplaceAddresses(userId: $userId) {
            success
            addresses {
              ${ADDRESS_FRAGMENT}
            }
          }
        }
      `

      const result = await graphqlRequest<MarketplaceAddressListResponse>(
        query,
        { userId: resolvedUserId },
        token,
      )

      if (!result.marketplaceAddresses.success) {
        throw new Error('Failed to fetch addresses')
      }

      return result.marketplaceAddresses.addresses
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch addresses'
      logError('Failed to fetch addresses', { error: msg })
      throw new Error(msg)
    }
  })
}

export async function createMarketplaceAddress(token: string, data: CreateAddressInput, userId?: number) {
  return trackAsync('createMarketplaceAddress', async () => {
    try {
      const resolvedUserId = resolveUserId(token, userId)
      const mutation = `
        mutation CreateMarketplaceAddress($userId: Int!, $input: CreateMarketplaceAddressInput!) {
          createMarketplaceAddress(userId: $userId, input: $input) {
            success
            message
            address {
              ${ADDRESS_FRAGMENT}
            }
          }
        }
      `

      const result = await graphqlRequest<CreateMarketplaceAddressResponse>(
        mutation,
        { userId: resolvedUserId, input: data },
        token,
      )

      const payload = result.createMarketplaceAddress
      if (!payload.success || !payload.address) {
        throw new Error(payload.message || 'Failed to create address')
      }

      return payload.address
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create address'
      logError('Failed to create address', { error: msg, data })
      throw new Error(msg)
    }
  })
}

export async function updateMarketplaceAddress(
  token: string,
  addressId: number,
  data: UpdateAddressInput,
  userId?: number,
) {
  return trackAsync('updateMarketplaceAddress', async () => {
    try {
      const resolvedUserId = resolveUserId(token, userId)
      const mutation = `
        mutation UpdateMarketplaceAddress($userId: Int!, $addressId: Int!, $input: UpdateMarketplaceAddressInput!) {
          updateMarketplaceAddress(userId: $userId, addressId: $addressId, input: $input) {
            success
            message
            address {
              ${ADDRESS_FRAGMENT}
            }
          }
        }
      `

      const result = await graphqlRequest<UpdateMarketplaceAddressResponse>(
        mutation,
        { userId: resolvedUserId, addressId, input: data },
        token,
      )

      const payload = result.updateMarketplaceAddress
      if (!payload.success || !payload.address) {
        throw new Error(payload.message || 'Failed to update address')
      }

      return payload.address
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update address'
      logError('Failed to update address', { error: msg, data, addressId })
      throw new Error(msg)
    }
  })
}

export async function deleteMarketplaceAddress(token: string, addressId: number, userId?: number) {
  return trackAsync('deleteMarketplaceAddress', async () => {
    try {
      const resolvedUserId = resolveUserId(token, userId)
      const mutation = `
        mutation DeleteMarketplaceAddress($userId: Int!, $addressId: Int!) {
          deleteMarketplaceAddress(userId: $userId, addressId: $addressId) {
            success
            message
            address {
              ${ADDRESS_FRAGMENT}
            }
          }
        }
      `

      const result = await graphqlRequest<DeleteMarketplaceAddressResponse>(
        mutation,
        { userId: resolvedUserId, addressId },
        token,
      )

      const payload = result.deleteMarketplaceAddress
      if (!payload.success) {
        throw new Error(payload.message || 'Failed to delete address')
      }

      return payload.address ?? null
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete address'
      logError('Failed to delete address', { error: msg, addressId })
      throw new Error(msg)
    }
  })
}

