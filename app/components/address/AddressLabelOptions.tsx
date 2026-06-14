import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

export type AddressLabel = 'work' | 'store' | 'home';

const LABELS: AddressLabel[] = ['work', 'store', 'home'];

interface AddressLabelOptionsProps {
  isDefault: boolean;
  label: AddressLabel;
  onDefaultChange: (value: boolean) => void;
  onLabelChange: (value: AddressLabel) => void;
  disableDefaultToggle?: boolean;
}

export default function AddressLabelOptions({
  isDefault,
  label,
  onDefaultChange,
  onLabelChange,
  disableDefaultToggle = false,
}: AddressLabelOptionsProps) {
  const { t } = useTranslation();

  return (
    <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#111827' }}>{t('profile.editAddress.setDefault')}</Text>
        <Switch
          value={isDefault}
          onValueChange={onDefaultChange}
          disabled={disableDefaultToggle}
          trackColor={{ true: '#0a61d733', false: '#e5e7eb' }}
          thumbColor={isDefault ? '#0a61d7' : '#f3f4f6'}
        />
      </View>
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: '#111827', marginBottom: 8 }}>{t('profile.editAddress.labelAs')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {LABELS.map((l) => (
            <Pressable
              key={l}
              onPress={() => onLabelChange(l)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: label === l ? '#0a61d7' : '#e5e7eb',
                backgroundColor: label === l ? '#0a61d71a' : '#ffffff',
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: label === l ? '#0a61d7' : '#111827',
                  fontWeight: '600',
                }}
              >
                {t(`profile.editAddress.labels.${l}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
