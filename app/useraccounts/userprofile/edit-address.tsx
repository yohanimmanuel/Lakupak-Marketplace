import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Text,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuthStore } from '../../../stores/authStore';
import {
  updateMe,
  getMarketplaceAddresses,
  createMarketplaceAddress as createAddress,
  updateMarketplaceAddress as updateAddress,
} from '../../../services/user';
import { useTranslation } from 'react-i18next';
import AddressMapPreview from '../../components/address/AddressMapPreview';
import AddressLocationFields from '../../components/address/AddressLocationFields';
import AddressLabelOptions, { type AddressLabel } from '../../components/address/AddressLabelOptions';
import { reverseGeocode, type GeocodePrecision } from '../../../services/geocode';

const normalizeLabel = (value?: string | null): AddressLabel => {
  if (value === 'work' || value === 'store' || value === 'home') {
    return value
  }
  return 'home'
}

export default function EditAddress() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const token = useAuthStore(s => s.token) as string | null;
  const setUser = useAuthStore(s => s.setUser);
  const params = useLocalSearchParams<{ id?: string }>();
  const [id, setId] = useState<number | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [label, setLabel] = useState<AddressLabel>('home');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [savedAddressSnapshot, setSavedAddressSnapshot] = useState('');
  const [savedCoordinates, setSavedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedPrecision, setSavedPrecision] = useState<GeocodePrecision | null>(null);
  const [locating, setLocating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fieldScrollY = useRef<Partial<Record<'address' | 'fullName' | 'phone', number>>>({});

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (params.id) {
      const n = Number(params.id)
      if (!Number.isNaN(n)) setId(n)
    }
  }, [params])

  useEffect(() => {
    const load = async () => {
      if (!token || !id) return
      try {
        const list = await getMarketplaceAddresses(token)
        const cur = list.find(a => a.id === id)
        if (cur) {
          setFullName(cur.fullName ?? '')
          setPhone(cur.phone ?? '')
          setAddress(cur.address ?? '')
          setIsDefault(Boolean(cur.isDefault))
          setLabel(normalizeLabel(cur.label))
          const snapshot = (cur.address ?? '').trim()
          setSavedAddressSnapshot(snapshot)
          if (cur.latitude != null && cur.longitude != null) {
            setSavedCoordinates({ latitude: cur.latitude, longitude: cur.longitude })
            setSavedPrecision(
              cur.geocodePrecision === 'exact' ||
                cur.geocodePrecision === 'approximate' ||
                cur.geocodePrecision === 'area'
                ? cur.geocodePrecision
                : null,
            )
          } else {
            setSavedCoordinates(null)
            setSavedPrecision(null)
          }
        }
      } catch {}
    }
    load()
  }, [id, token])

  const onUseCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      Keyboard.dismiss();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('profile.editAddress.locationPermissionTitle'),
          t('profile.editAddress.locationPermissionBody'),
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = position.coords;

      const result = await reverseGeocode(latitude, longitude, token);
      if (!result || !result.address.trim()) {
        // Still drop the GPS pin so the map reflects where they are.
        setAddress('');
        setSavedAddressSnapshot('');
        setSavedCoordinates({ latitude, longitude });
        setSavedPrecision('exact');
        Alert.alert(
          t('profile.editAddress.locationErrorTitle'),
          t('profile.editAddress.locationNotFound'),
        );
        return;
      }

      const resolvedAddress = result.address.trim();
      const coords = result.coordinates ?? { latitude, longitude };
      setAddress(resolvedAddress);
      // Prime the map preview with the exact GPS pin so it doesn't re-geocode
      // the freshly filled text and drift from the real location.
      setSavedAddressSnapshot(resolvedAddress);
      setSavedCoordinates(coords);
      setSavedPrecision(result.precision ?? 'exact');
    } catch {
      Alert.alert(
        t('profile.editAddress.locationErrorTitle'),
        t('profile.editAddress.locationErrorBody'),
      );
    } finally {
      setLocating(false);
    }
  };

  const onSave = async () => {
    try {
      if (!token) return Alert.alert(t('profile.common.unauthorized'));
      if (id) {
        await updateAddress(token, id, { fullName, phone, address, isDefault, label })
      } else {
        await createAddress(token, { fullName, phone, address, isDefault, label })
      }
      const updated = await updateMe(token, { name: fullName, phone, chosenAddress: isDefault ? address : undefined });
      setUser(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert(t('profile.common.errorTitle'), t('profile.common.failedToUpdate'));
    }
  };

  const bottomBarPadding = Math.max(insets.bottom, 16);
  const bottomBarHeight = 96 + bottomBarPadding;
  const scrollBottomPadding = useMemo(() => {
    const base = bottomBarHeight + 24;
    if (Platform.OS === 'android' && keyboardHeight > 0) {
      return base + keyboardHeight;
    }
    return base;
  }, [bottomBarHeight, keyboardHeight]);

  const headerKeyboardOffset = Platform.OS === 'ios' ? Math.max(insets.top, 44) + 72 : 0;

  const scrollToFocusedField = (field: 'address' | 'fullName' | 'phone') => {
    const delay = Platform.OS === 'ios' ? 250 : 100;
    if (field === 'phone') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), delay);
      return;
    }
    const y = fieldScrollY.current[field];
    if (y == null) return;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, delay);
  };

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}
                  accessibilityLabel={t('profile.common.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>
                  {id ? t('profile.editAddress.editTitle') : t('profile.editAddress.newTitle')}
                </Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={headerKeyboardOffset}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: scrollBottomPadding }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            automaticallyAdjustKeyboardInsets
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            {t('profile.editAddress.shippingAddress')}
          </Text>
          <AddressMapPreview
            address={address}
            savedCoordinates={
              address.trim() === savedAddressSnapshot && savedCoordinates
                ? savedCoordinates
                : null
            }
            savedPrecision={
              address.trim() === savedAddressSnapshot ? savedPrecision : null
            }
          />
          <AddressLocationFields
            address={address}
            fullName={fullName}
            phone={phone}
            onAddressChange={setAddress}
            onFullNameChange={setFullName}
            onPhoneChange={setPhone}
            onInputFocus={scrollToFocusedField}
            onFieldLayout={(field, y) => {
              fieldScrollY.current[field] = y;
            }}
            onUseCurrentLocation={onUseCurrentLocation}
            locating={locating}
          />
          <AddressLabelOptions
            isDefault={isDefault}
            label={label}
            onDefaultChange={setIsDefault}
            onLabelChange={setLabel}
          />
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomBarPadding,
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
            backgroundColor: '#ffffff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 5,
          }}
        >
          <Pressable
            onPress={onSave}
            style={{ backgroundColor: '#0a61d7', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('profile.common.save')}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
