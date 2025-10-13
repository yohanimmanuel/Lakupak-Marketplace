import { API_BASE_URL } from './config';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

/**
 * Direct upload to Cloudinary (faster, optimized for mobile)
 * Uses native file upload instead of base64 conversion
 */
export const uploadImageToCloudinaryDirect = async (
  imageUri: string,
  folder: string = 'products'
): Promise<ImageUploadResult> => {
  try {
    // Step 1: Get upload signature from backend
    const signatureResponse = await fetch(`${API_BASE_URL}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        getSignature: true,
        folder,
      }),
    });

    if (!signatureResponse.ok) {
      throw new Error('Failed to get upload signature');
    }

    const signatureData = await signatureResponse.json();

    // Step 2: Upload directly to Cloudinary using native file
    const formData = new FormData();
    
    // Create file object from URI (React Native)
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as { uri: string; name: string; type: string });
    
    formData.append('signature', signatureData.signature);
    formData.append('timestamp', signatureData.timestamp.toString());
    formData.append('api_key', signatureData.apiKey);
    formData.append('folder', signatureData.folder);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error?.message || 'Upload to Cloudinary failed');
    }

    const result = await uploadResponse.json();

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
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

