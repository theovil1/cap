import { router } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import { useUpdateProfile } from '@/api/profile';
import { allCountries, flag } from '@/i18n/countries';
import { fonts, useColors } from '@/theme';
import { SearchBar } from '@/ui/controls';
import { ScreenHeader } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

/** Every country of the world, with its flag, searchable. */
export default function CountryScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const [query, setQuery] = useState('');
  const countries = useMemo(() => allCountries(), []);
  // "Equateur" finds "Équateur": accents are dropped on both sides.
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = countries.filter(
    (c) => plain(c.name).includes(plain(query)) || c.code === query.toUpperCase(),
  );
  const pick = (country: string) => {
    update.mutate({ country });
    router.back();
  };
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.head}>
        <ScreenHeader title={t('account.country')}>
          <RoundButton
            icon={<X size={20} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.close')}
          />
        </ScreenHeader>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('account.searchCountry')} />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
        renderItem={({ item }) => {
          const on = item.code === user?.country;
          return (
            <Pressable
              onPress={() => pick(item.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.name}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Text style={styles.flag}>{flag(item.code)}</Text>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              {on ? <Check size={20} color={colors.accentText} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 20, gap: 14, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 24 },
  name: { flex: 1, fontFamily: fonts.textMedium, fontSize: 16 },
});
