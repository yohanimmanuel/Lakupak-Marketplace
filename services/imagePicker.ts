import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryDirect } from './imageUpload';

/** Short delay so content URIs (e.g. Android gallery) are readable before upload; reduces first-upload failures. */
const UPLOAD_READY_DELAY_MS = Platform.OS === 'android' ? 250 : 100;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PickImageOptions = {
  folder?: string;
  allowsEditing?: boolean;
  aspect?: [number, number];
};

export type PickMultipleOptions = {
  folder?: string;
  selectionLimit?: number;
};

const DEFAULT_FOLDER = 'avatars';
const DEFAULT_MULTI_LIMIT = 5;

export async function pickImage(options: PickImageOptions = {}): Promise<string | null> {
  const { folder = DEFAULT_FOLDER, allowsEditing = true, aspect = [1, 1] } = options;
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library is required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing,
      aspect,
      quality: 0.7,
      exif: false,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      await delay(UPLOAD_READY_DELAY_MS);
      const uploadResult = await uploadImageToCloudinaryDirect(result.assets[0].uri, folder);
      if (uploadResult.success && uploadResult.url) {
        return uploadResult.url;
      }
      throw new Error(uploadResult.error || 'Upload failed');
    }

    return null;
  } catch (error) {
    throw error;
  }
}

export async function takePhoto(options: PickImageOptions = {}): Promise<string | null> {
  const { folder = DEFAULT_FOLDER, allowsEditing = true, aspect = [1, 1] } = options;
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access camera is required');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing,
      aspect,
      quality: 0.7,
      exif: false,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      await delay(UPLOAD_READY_DELAY_MS);
      const uploadResult = await uploadImageToCloudinaryDirect(result.assets[0].uri, folder);
      if (uploadResult.success && uploadResult.url) {
        return uploadResult.url;
      }
      throw new Error(uploadResult.error || 'Upload failed');
    }

    return null;
  } catch (error) {
    throw error;
  }
}

/**
 * Pick multiple images at once (e.g. for review photos). Uploads each to Cloudinary and returns URLs.
 */
export async function pickMultipleImages(options: PickMultipleOptions = {}): Promise<string[]> {
  const { folder = DEFAULT_FOLDER, selectionLimit = DEFAULT_MULTI_LIMIT } = options;
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library is required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, Math.min(selectionLimit, 10)),
      allowsEditing: false,
      quality: 0.7,
      exif: false,
      base64: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      await delay(UPLOAD_READY_DELAY_MS);
      const urls: string[] = [];
      for (const asset of result.assets) {
        const uploadResult = await uploadImageToCloudinaryDirect(asset.uri, folder);
        if (uploadResult.success && uploadResult.url) {
          urls.push(uploadResult.url);
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }
      }
      return urls;
    }

    return [];
  } catch (error) {
    throw error;
  }
}
