import { API_BASE_URL } from './config';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && (error.message === 'Failed to fetch' || error.message.includes('Network request failed'))) return true;
  if (error instanceof Error && /network|fetch|request failed/i.test(error.message)) return true;
  return false;
}

/**
 * Server-mediated upload: send file to backend, backend uploads to Cloudinary.
 * Same flow as profile/banner upload; no client-side signature needed.
 * Retries once after a short delay on network error (fixes first-upload failure on Android/content URIs).
 */
export const uploadImageToCloudinaryDirect = async (
  imageUri: string,
  folder: string = 'products'
): Promise<ImageUploadResult> => {
  const doUpload = async (): Promise<ImageUploadResult> => {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    // React Native FormData: append file with uri, name, type
    // @ts-ignore - RN FormData accepts { uri, name, type }
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: type === 'image/jpg' ? 'image/jpeg' : type,
    });
    formData.append('folder', folder);

    const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
      method: 'POST',
      body: formData,
      // Do not set Content-Type so React Native sets multipart/form-data with boundary
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error || response.statusText || 'Upload failed';
      throw new Error(msg);
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url,
      publicId: data.publicId,
    };
  };

  try {
    return await doUpload();
  } catch (error) {
    if (isNetworkError(error)) {
      await delay(400);
      try {
        return await doUpload();
      } catch (retryError) {
        return {
          success: false,
          error: retryError instanceof Error ? retryError.message : 'Upload failed',
        };
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

/**
 * Legacy base64 upload method (kept for backwards compatibility)
 * Note: Direct upload is faster and should be used instead
 */
export const uploadImageToCloudinary = async (
  imageUri: string,
  folder: string = 'products'
): Promise<ImageUploadResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageUri,
        folder,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Upload failed',
      };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url,
      publicId: data.publicId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

export const deleteImageFromCloudinary = async (
  publicId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/upload/image?publicId=${encodeURIComponent(publicId)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Delete failed',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

