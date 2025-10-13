import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryDirect } from './imageUpload';

export async function pickImage(): Promise<string | null> {
  try {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library is required');
    }

    // Launch image picker with optimized settings
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // Reduced for better performance
      exif: false, // Disable EXIF data for faster processing
      base64: false, // No base64 needed for direct upload
    });

    if (!result.canceled && result.assets[0]) {
      // Direct upload to Cloudinary (faster, no base64 conversion)
      const uploadResult = await uploadImageToCloudinaryDirect(result.assets[0].uri, 'users');
      
      if (uploadResult.success && uploadResult.url) {
        return uploadResult.url;
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    }

    return null;
  } catch (error) {
    throw error;
  }
}

export async function takePhoto(): Promise<string | null> {
  try {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access camera is required');
    }

    // Launch camera with optimized settings
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // Reduced for better performance
      exif: false, // Disable EXIF data for faster processing
      base64: false, // No base64 needed for direct upload
    });

    if (!result.canceled && result.assets[0]) {
      // Direct upload to Cloudinary (faster, no base64 conversion)
      const uploadResult = await uploadImageToCloudinaryDirect(result.assets[0].uri, 'users');
      
      if (uploadResult.success && uploadResult.url) {
        return uploadResult.url;
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    }

    return null;
  } catch (error) {
    throw error;
  }
}
