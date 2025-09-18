import * as ImagePicker from 'expo-image-picker';

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
      base64: false, // Don't include base64 for better performance
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
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
      base64: false, // Don't include base64 for better performance
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    throw error;
  }
}
