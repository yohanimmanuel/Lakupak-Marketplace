import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { Plus, Trash2, Circle, CheckCircle2 } from 'lucide-react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Address = { id: number; fullName: string; phone: string; address: string; isDefault: boolean; label: string }

export default function AddressesList() {
  const token = useAuthStore(s => s.token) as string | null;
  const [list, setList] = useState<Address[]>([]);
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const navigation = useNavigation()

  const load = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load addresses:', error)
      setList([])
    }
  }

  useEffect(() => { load() }, [token])

  // Refresh whenever screen gets focus (after returning from edit)
  useFocusEffect(
    useCallback(() => {
      load()
    }, [token])
  )

  React.useLayoutEffect?.(() => {
    navigation.setOptions?.({
      headerRight: () => (
        deleteMode ? (
          <Pressable onPress={() => { setDeleteMode(false); setSelectedIds(new Set()) }} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ color: '#0a61d7', fontWeight: '700' }}>Undo</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => { setDeleteMode(true) }} style={{ padding: 8 }}>
            <Trash2 color="#ef4444" size={18} />
          </Pressable>
        )
      ),
    })
  }, [navigation, deleteMode])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const performBulkDelete = async () => {
    if (!token || selectedIds.size === 0) { setDeleteMode(false); return }
    Alert.alert('Delete address', 'Are you sure you want to delete selected address(es)?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const ids = Array.from(selectedIds)
        for (const id of ids) {
          await fetch(`${API_BASE_URL}/api/mobile/addresses`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id }),
          })
        }
        setSelectedIds(new Set())
        setDeleteMode(false)
        await load()
      } }
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: '#6B7280', marginBottom: 8 }}>Address</Text>
        {(list || []).map((a) => (
          <View key={a.id} style={{ borderWidth: 1, borderColor: selectedIds.has(a.id) && deleteMode ? '#0a61d7' : '#e5e7eb', backgroundColor: selectedIds.has(a.id) && deleteMode ? '#0a61d70d' : '#ffffff', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            {deleteMode && (
              <Pressable onPress={() => toggleSelect(a.id)} hitSlop={10} style={{ position: 'absolute', right: 10, top: 10 }}>
                {selectedIds.has(a.id) ? <CheckCircle2 color="#0a61d7" size={20} /> : <Circle color="#9CA3AF" size={20} />}
              </Pressable>
            )}
            {deleteMode ? (
              <Pressable onPress={() => toggleSelect(a.id)}>
                <Text style={{ fontWeight: '700', color: '#111827' }}>{a.fullName}  <Text style={{ color: '#6B7280' }}>|  {a.phone}</Text></Text>
                <Text style={{ color: '#111827', marginTop: 6 }}>{a.address}</Text>
              </Pressable>
            ) : (
              <Link href={{ pathname: '/useraccounts/userprofile/edit-address', params: { id: String(a.id) } }} asChild>
                <Pressable>
                  <Text style={{ fontWeight: '700', color: '#111827' }}>{a.fullName}  <Text style={{ color: '#6B7280' }}>|  {a.phone}</Text></Text>
                  <Text style={{ color: '#111827', marginTop: 6 }}>{a.address}</Text>
                </Pressable>
              </Link>
            )}
            {a.isDefault && (
              <View style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' }}>
                <Text style={{ color: '#ef4444' }}>Default</Text>
              </View>
            )}
          </View>
        ))}

        <Link href={{ pathname: '/useraccounts/userprofile/edit-address' }} asChild>
          <Pressable disabled={deleteMode} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderWidth: 1, borderColor: '#0a61d7', borderStyle: 'dashed', borderRadius: 12, opacity: deleteMode ? 0.5 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Plus color="#0a61d7" size={18} />
              <Text style={{ color: '#0a61d7', marginLeft: 8, fontWeight: '600' }}>Add a new address</Text>
            </View>
          </Pressable>
        </Link>
      </ScrollView>
      {deleteMode && (
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#ffffff' }}>
          <Pressable onPress={performBulkDelete} style={{ backgroundColor: selectedIds.size > 0 ? '#ef4444' : '#e5e7eb', paddingVertical: 14, borderRadius: 10 }}>
            <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '700' }}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}


