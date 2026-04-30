import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { Plus, Trash2, Circle, CheckCircle2 } from 'lucide-react-native';
import { Stack, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { getMarketplaceAddresses, deleteMarketplaceAddress, MobileAddress } from '../../../services/user';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

type Address = MobileAddress

export default function AddressesList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const token = useAuthStore(s => s.token) as string | null;
  const [list, setList] = useState<Address[]>([]);
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getMarketplaceAddresses(token)
      setList(data ?? [])
    } catch (error) {
      setList([])
    }
  }, [token]); // Wrapped in useCallback with token dependency

  useEffect(() => { load() }, [load]) // Now load is stable, so we can include it

  // Refresh whenever screen gets focus (after returning from edit)
  useFocusEffect(
    useCallback(() => {
      load()
    }, [token])
  )


  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const performBulkDelete = async () => {
    if (!token || selectedIds.size === 0) { setDeleteMode(false); return }
    Alert.alert(t('profile.addresses.deleteAlertTitle'), t('profile.addresses.deleteAlertBody'), [
      { text: t('profile.addresses.deleteCancel'), style: 'cancel' },
      { text: t('profile.addresses.deleteConfirm'), style: 'destructive', onPress: async () => {
        const ids = Array.from(selectedIds)
        for (const id of ids) {
          await deleteMarketplaceAddress(token, id)
        }
        setSelectedIds(new Set())
        setDeleteMode(false)
        await load()
      } }
    ])
  }

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
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('profile.addresses.title')}</Text>
                {deleteMode ? (
                  <Pressable onPress={() => { setDeleteMode(false); setSelectedIds(new Set()) }} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                    <Text style={{ color: '#0a61d7', fontWeight: '700' }}>{t('profile.common.undo')}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => { setDeleteMode(true) }} style={{ padding: 8 }}>
                    <Trash2 color="#ef4444" size={18} />
                  </Pressable>
                )}
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: '#6B7280', marginBottom: 8 }}>{t('profile.addresses.label')}</Text>
        {(list || []).map((a) => (
          <View key={a.id} style={{ borderWidth: 1, borderColor: selectedIds.has(a.id) && deleteMode ? '#0a61d7' : '#e5e7eb', backgroundColor: selectedIds.has(a.id) && deleteMode ? '#0a61d70d' : '#ffffff', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            {deleteMode && (
              <Pressable onPress={() => toggleSelect(a.id)} hitSlop={10} style={{ position: 'absolute', right: 10, top: 10 }}>
                {selectedIds.has(a.id) ? <CheckCircle2 color="#0a61d7" size={20} /> : <Circle color="#9CA3AF" size={20} />}
              </Pressable>
            )}
            {deleteMode ? (
              <Pressable onPress={() => toggleSelect(a.id)}>
                <Text style={{ fontWeight: '700', color: '#111827' }}>{a.fullName ?? ''}  <Text style={{ color: '#6B7280' }}>|  {a.phone ?? ''}</Text></Text>
                <Text style={{ color: '#111827', marginTop: 6 }}>{a.address ?? ''}</Text>
              </Pressable>
            ) : (
              <Link href={{ pathname: '/useraccounts/userprofile/edit-address', params: { id: String(a.id) } }} asChild>
                <Pressable>
                  <Text style={{ fontWeight: '700', color: '#111827' }}>{a.fullName ?? ''}  <Text style={{ color: '#6B7280' }}>|  {a.phone ?? ''}</Text></Text>
                  <Text style={{ color: '#111827', marginTop: 6 }}>{a.address ?? ''}</Text>
                </Pressable>
              </Link>
            )}
            {a.isDefault && (
              <View style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' }}>
                <Text style={{ color: '#ef4444' }}>{t('profile.addresses.defaultBadge')}</Text>
              </View>
            )}
          </View>
        ))}

        <Link href={{ pathname: '/useraccounts/userprofile/edit-address' }} asChild>
          <Pressable disabled={deleteMode} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderWidth: 1, borderColor: '#0a61d7', borderStyle: 'dashed', borderRadius: 12, opacity: deleteMode ? 0.5 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Plus color="#0a61d7" size={18} />
              <Text style={{ color: '#0a61d7', marginLeft: 8, fontWeight: '600' }}>{t('profile.addresses.addNew')}</Text>
            </View>
          </Pressable>
        </Link>
      </ScrollView>
      {deleteMode && (
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#ffffff' }}>
          <Pressable onPress={performBulkDelete} style={{ backgroundColor: selectedIds.size > 0 ? '#ef4444' : '#e5e7eb', paddingVertical: 14, borderRadius: 10 }}>
            <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '700' }}>{t('profile.addresses.delete')}</Text>
          </Pressable>
        </View>
      )}
      </View>
    </>
  );
}


