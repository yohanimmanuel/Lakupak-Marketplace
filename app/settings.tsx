import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronRight, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { Stack, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getPreferredLanguage } from '../utils/preferences';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const logout = useAuthStore(s => s.logout);
  const { t } = useTranslation();

  const [currentLanguage, setCurrentLanguage] = useState<'id' | 'en'>('id');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const prefLang = await getPreferredLanguage();
      if (!alive) return;
      if (prefLang) setCurrentLanguage(prefLang);
      else setCurrentLanguage(i18n.language === 'en' ? 'en' : 'id');
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Keep the displayed language in sync when user switches languages on the language settings page.
  useEffect(() => {
    const handler = (lang: string) => {
      setCurrentLanguage(lang === 'en' ? 'en' : 'id');
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={{ backgroundColor: '#f9fafb', paddingVertical: 10, paddingHorizontal: 16 }}>
      <Text style={{ color: '#6B7280', fontWeight: '600' }}>{title}</Text>
    </View>
  );

  const Row = ({ title, rightText, onPress, href }: { title: string; rightText?: string; onPress?: () => void; href?: Parameters<typeof Link>[0]['href'] }) => {
    const content = (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#ffffff' }}>
        <Text style={{ color: '#111827', fontSize: 15, flex: 1 }} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
          {rightText ? (
            <Text style={{ color: '#6B7280', marginRight: 8, fontSize: 13 }} numberOfLines={1}>
              {rightText}
            </Text>
          ) : null}
          <ChevronRight color="#6B7280" size={18} />
        </View>
      </View>
    )
    if (href) {
      return (
        <Link href={href} asChild>
          <Pressable>{content}</Pressable>
        </Link>
      )
    }
    return <Pressable onPress={onPress}>{content}</Pressable>
  };

  const onLogout = async () => {
    // Navigate immediately for instant UI response
    router.replace('/(tabs)/account');
    // Clear auth state in background
    logout();
  };

  const languageLabel = useMemo(() => {
    return currentLanguage === 'en' ? t('settings.languages.en') : t('settings.languages.id');
  }, [currentLanguage, t]);

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
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('settings.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ScrollView style={{ flex: 1 }}>
        <SectionHeader title={t('settings.sections.myAccount')} />
        <Row title={t('settings.rows.accountSecurity')} href={{ pathname: '/useraccounts/userprofile/editprofile' }} />
        <Row title={t('settings.rows.myAddresses')} href={{ pathname: '/useraccounts/userprofile/addresses' }} />
        <Row title={t('settings.rows.linkedPayments')} />

        <SectionHeader title={t('settings.sections.settings')} />
        <Row title={t('settings.rows.notificationSettings')} href={{ pathname: '/settings/notifications' as never }} />
        <Row title={t('settings.rows.languageSettings')} rightText={hydrated ? languageLabel : undefined} href={{ pathname: '/settings/language' as never }} />

        <SectionHeader title={t('settings.sections.support')} />
        <Row title={t('settings.rows.helpCenter')} href={{ pathname: '/useraccounts/consent/helpcenter' }} />
        <Row title={t('settings.rows.communityRules')} href={{ pathname: '/useraccounts/consent/community-rules' }} />
        <Row title={t('settings.rows.policies')} href={{ pathname: '/useraccounts/consent/security-privacy' }} />
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#ffffff' }}>
        <Pressable onPress={onLogout} style={{ backgroundColor: '#0a61d7', paddingVertical: 14, borderRadius: 10 }}>
          <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '700' }}>{t('settings.logout')}</Text>
        </Pressable>
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
});
