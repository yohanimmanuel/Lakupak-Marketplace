import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert } from 'react-native';
import { Stack, useRouter, Link, type LinkProps } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Camera, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { updateMe } from '../../../services/user';
import { pickImage, takePhoto } from '../../../services/imagePicker';

export default function EditProfileModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
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
    } catch (error: unknown) {
      Alert.alert('Error', (error instanceof Error ? error.message : `Failed to update ${type === 'profile' ? 'profile picture' : 'banner image'}`));
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
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>Profile</Text>
              </View>
            </View>
          ),
        }}
      />
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
              {user?.username?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'U'}
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
      
      <Row title="Username" value={user?.username || user?.name} href={{ pathname: '/useraccounts/userprofile/edit-username' }} />
      <Row title="Name" value={user?.name} href={{ pathname: '/useraccounts/userprofile/edit-name' }} />
      <Row title="Store Name" value={user?.storeName} href={{ pathname: '/useraccounts/userprofile/edit-store-name' }} />
      <Row title="Bio" value={user?.bio} href={{ pathname: '/useraccounts/userprofile/edit-bio' }} />
      <Row title="Phone" value={user?.phone} href={{ pathname: '/useraccounts/userprofile/edit-phone' }} />
      <Row title="Email" value={user?.email} href={{ pathname: '/useraccounts/userprofile/edit-email' }} />
      <Row title="Address" value={user?.chosenAddress} href={{ pathname: '/useraccounts/userprofile/addresses' }} />
      <Row title="Country" value={user?.country} href={{ pathname: '/useraccounts/userprofile/edit-country' }} />
    </ScrollView>
    </>
  );
}


