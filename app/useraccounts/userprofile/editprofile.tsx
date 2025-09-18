import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert } from 'react-native';
import { ChevronRight, Camera } from 'lucide-react-native';
import { Link, type LinkProps } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { updateMe } from '../../../services/user';
import { pickImage, takePhoto } from '../../../services/imagePicker';

export default function EditProfileModal() {
  const iconGray = '#6B7280';
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const setUser = useAuthStore(s => s.setUser);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async () => {
    if (!token) return;

    Alert.alert(
      'Select Image',
      'Choose what you want to edit',
      [
        { text: 'Profile Picture', onPress: () => showImagePicker('profile') },
        { text: 'Banner Image', onPress: () => showImagePicker('banner') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const showImagePicker = (type: 'profile' | 'banner') => {
    Alert.alert(
      'Select Image',
      `Choose how you want to add your ${type === 'profile' ? 'profile picture' : 'banner image'}`,
      [
        { text: 'Camera', onPress: () => uploadImage('camera', type) },
        { text: 'Photo Library', onPress: () => uploadImage('library', type) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadImage = async (source: 'camera' | 'library', type: 'profile' | 'banner') => {
    if (!token) return;

    try {
      setIsUploading(true);
      
      const imageUri = source === 'camera' ? await takePhoto() : await pickImage();
      
      if (!imageUri) return;

      // Update user profile with image URI
      const updateData = type === 'profile' ? { image: imageUri } : { bannerImage: imageUri };
      const updatedUser = await updateMe(token, updateData);
      setUser(updatedUser);
      
      Alert.alert('Success', `${type === 'profile' ? 'Profile picture' : 'Banner image'} updated successfully!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to update ${type === 'profile' ? 'profile picture' : 'banner image'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const Row = ({ title, value, href }: { title: string; value?: string | null; href: LinkProps['href'] }) => (
    <Link href={href} asChild>
      <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111827', fontSize: 15, fontWeight: '600', marginBottom: 4 }}>{title}</Text>
          <Text style={{ color: '#6B7280' }}>{value ?? 'Set Now'}</Text>
        </View>
        <ChevronRight color={iconGray} size={18} />
      </Pressable>
    </Link>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Profile Image Banner */}
      <View style={{ height: 160, backgroundColor: user?.bannerImage ? 'transparent' : '#0a61d7', position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
        {user?.bannerImage && (
          <Image source={{ uri: user.bannerImage }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />
        )}
        {user?.image ? (
          <Image source={{ uri: user.image }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#ffffff' }} />
        ) : (
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff' }}>
            <Text style={{ color: '#0a61d7', fontSize: 24, fontWeight: '600' }}>
              {(user as any)?.username?.charAt(0)?.toUpperCase() || (user as any)?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        {/* Edit Image Button */}
        <Pressable 
          onPress={handleImageUpload}
          disabled={isUploading}
          style={{ 
            position: 'absolute', 
            bottom: 20, 
            right: 20, 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            backgroundColor: '#ffffff', 
            alignItems: 'center', 
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            opacity: isUploading ? 0.6 : 1,
          }}
        >
          <Camera color="#0a61d7" size={20} />
        </Pressable>
      </View>
      
      <Row title="Username" value={(user as any)?.username || (user as any)?.name} href={{ pathname: '/useraccounts/userprofile/edit-username' }} />
      <Row title="Name" value={(user as any)?.name} href={{ pathname: '/useraccounts/userprofile/edit-name' }} />
      <Row title="Store Name" value={(user as any)?.storeName} href={{ pathname: '/useraccounts/userprofile/edit-store-name' }} />
      <Row title="Bio" value={(user as any)?.bio} href={{ pathname: '/useraccounts/userprofile/edit-bio' }} />
      <Row title="Phone" value={(user as any)?.phone} href={{ pathname: '/useraccounts/userprofile/edit-phone' }} />
      <Row title="Email" value={(user as any)?.email} href={{ pathname: '/useraccounts/userprofile/edit-email' }} />
      <Row title="Address" value={(user as any)?.chosenAddress} href={{ pathname: '/useraccounts/userprofile/addresses' }} />
      <Row title="Country" value={(user as any)?.country} href={{ pathname: '/useraccounts/userprofile/edit-country' }} />
    </ScrollView>
  );
}


