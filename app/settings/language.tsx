import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { getPreferredLanguage, setPreferredLanguage } from '../../utils/preferences';

export default function LanguageSettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();

  const [currentLanguage, setCurrentLanguage] = useState<'id' | 'en'>(i18n.language === 'en' ? 'en' : 'id');

  useEffect(() => {
    let alive = true;
    (async () => {
      const pref = await getPreferredLanguage();
      if (!alive) return;
      if (pref) setCurrentLanguage(pref);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const headerTitle = useMemo(() => t('settings.rows.languageSettings'), [t]);

  const selectLanguage = async (lang: 'id' | 'en') => {
    setCurrentLanguage(lang);
    await setPreferredLanguage(lang);
    await i18n.changeLanguage(lang);
  };

  const Option = ({ lang }: { lang: 'id' | 'en' }) => {
    const label = lang === 'id' ? t('settings.languages.id') : t('settings.languages.en');
    const active = currentLanguage === lang;
    return (
      <Pressable onPress={() => selectLanguage(lang)} style={[styles.row, active ? styles.rowActive : null]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{label}</Text>
        </View>
        <Text style={[styles.check, { opacity: active ? 1 : 0 }]} accessibilityLabel={active ? 'selected' : 'not-selected'}>
          ✓
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>
                  {headerTitle}
                </Text>
              </View>
            </View>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Text style={styles.subtitle}>{t('settings.pages.language.subtitle')}</Text>
        </View>

        <Option lang="id" />
        <Option lang="en" />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: '#6B7280', fontSize: 13 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  rowActive: {
    backgroundColor: '#f8fafc',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  check: { fontSize: 16, fontWeight: '900', color: '#0a61d7' },
});

