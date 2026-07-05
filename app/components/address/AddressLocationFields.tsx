import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface AddressLocationFieldsProps {
  address: string;
  fullName: string;
  phone: string;
  onAddressChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onInputFocus?: (field: 'address' | 'fullName' | 'phone') => void;
  onFieldLayout?: (field: 'address' | 'fullName' | 'phone', y: number) => void;
  onUseCurrentLocation?: () => void;
  locating?: boolean;
}

const fieldLabelStyle = {
  color: '#111827',
  fontSize: 14,
  fontWeight: '500' as const,
  marginBottom: 8,
};

const inputWrapperStyle = {
  backgroundColor: '#f9fafb',
  borderRadius: 12,
  paddingHorizontal: 16,
  borderWidth: 1,
  borderColor: '#e5e7eb',
};

const inputStyle = {
  paddingVertical: 16,
  fontSize: 16,
  color: '#111827',
};

export default function AddressLocationFields({
  address,
  fullName,
  phone,
  onAddressChange,
  onFullNameChange,
  onPhoneChange,
  onInputFocus,
  onFieldLayout,
  onUseCurrentLocation,
  locating = false,
}: AddressLocationFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
        {t('profile.editAddress.locationDetails')}
      </Text>

      {onUseCurrentLocation ? (
        <Pressable
          onPress={onUseCurrentLocation}
          disabled={locating}
          accessibilityRole="button"
          accessibilityState={{ disabled: locating, busy: locating }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#0a61d7',
            backgroundColor: pressed || locating ? '#eef4fe' : '#ffffff',
            marginBottom: 16,
            opacity: locating ? 0.9 : 1,
          })}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#0a61d7" />
          ) : (
            <LocateFixed color="#0a61d7" size={18} />
          )}
          <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '600' }}>
            {locating
              ? t('profile.editAddress.locatingCurrent')
              : t('profile.editAddress.useCurrentLocation')}
          </Text>
        </Pressable>
      ) : null}

      <View
        style={{ marginBottom: 16 }}
        onLayout={(e) => onFieldLayout?.('address', e.nativeEvent.layout.y)}
      >
        <Text style={fieldLabelStyle}>{t('profile.editAddress.address')}</Text>
        <View style={inputWrapperStyle}>
          <TextInput
            value={address}
            onChangeText={onAddressChange}
            onFocus={() => onInputFocus?.('address')}
            placeholder={t('profile.editAddress.addressPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ ...inputStyle, minHeight: 90 }}
          />
        </View>
      </View>

      <View
        style={{ marginBottom: 16 }}
        onLayout={(e) => onFieldLayout?.('fullName', e.nativeEvent.layout.y)}
      >
        <Text style={fieldLabelStyle}>{t('profile.editAddress.fullName')}</Text>
        <View style={inputWrapperStyle}>
          <TextInput
            value={fullName}
            onChangeText={onFullNameChange}
            onFocus={() => onInputFocus?.('fullName')}
            placeholder={t('profile.editAddress.fullNamePlaceholder')}
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View
        style={{ marginBottom: 16 }}
        onLayout={(e) => onFieldLayout?.('phone', e.nativeEvent.layout.y)}
      >
        <Text style={fieldLabelStyle}>{t('profile.editAddress.phone')}</Text>
        <View style={inputWrapperStyle}>
          <TextInput
            value={phone}
            onChangeText={onPhoneChange}
            onFocus={() => onInputFocus?.('phone')}
            placeholder={t('profile.editAddress.phonePlaceholder')}
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            style={inputStyle}
          />
        </View>
      </View>
    </>
  );
}
