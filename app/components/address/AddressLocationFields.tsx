import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

interface AddressLocationFieldsProps {
  address: string;
  fullName: string;
  phone: string;
  onAddressChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
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
}: AddressLocationFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
        {t('profile.editAddress.locationDetails')}
      </Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={fieldLabelStyle}>{t('profile.editAddress.address')}</Text>
        <View style={inputWrapperStyle}>
          <TextInput
            value={address}
            onChangeText={onAddressChange}
            placeholder={t('profile.editAddress.addressPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ ...inputStyle, minHeight: 90 }}
          />
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={fieldLabelStyle}>{t('profile.editAddress.fullName')}</Text>
        <View style={inputWrapperStyle}>
          <TextInput
            value={fullName}
            onChangeText={onFullNameChange}
            placeholder={t('profile.editAddress.fullNamePlaceholder')}
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={fieldLabelStyle}>{t('profile.editAddress.phone')}</Text>
        <View style={inputWrapperStyle}>
          <TextInput
            value={phone}
            onChangeText={onPhoneChange}
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
