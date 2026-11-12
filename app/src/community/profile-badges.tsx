import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProfileBadge } from '@/api/types';
import { fonts, useColors } from '@/theme';
import { Badge, BadgeChip } from '@/ui/badge';

/** "Soutien", "Grand soutien" or "Mécène" for supporters, else the badge name. */
export function useBadgeName() {
  const { t } = useTranslation();
  return (badge: ProfileBadge) =>
    badge.kind === 'supporter' && badge.tier
      ? t(`badges.tiers.${badge.tier}`)
      : t(`badges.names.${badge.kind}`);
}

/** What a badge says about someone, shown on a tap (the badge sheet of the mockups). */
function explain(name: string, description: string) {
  Alert.alert(name, description);
}

/** The Certifié seal next to a name, when the walker has it. */
export function NameBadge({ badges, size = 22 }: { badges: ProfileBadge[]; size?: number }) {
  const { t } = useTranslation();
  const name = useBadgeName();
  const certified = badges.find((b) => b.kind === 'certified');
  if (!certified) return null;
  return (
    <Pressable
      onPress={() => explain(name(certified), t('badges.about.certified'))}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Badge kind="certified" size={size} label={name(certified)} />
    </Pressable>
  );
}

/** The other badges as chips: three, then "+N" to see them all. */
export function BadgeRow({ badges }: { badges: ProfileBadge[] }) {
  const { t } = useTranslation();
  const colors = useColors();
  const name = useBadgeName();
  const [all, setAll] = useState(false);
  const others = badges.filter((b) => b.kind !== 'certified');
  if (others.length === 0) return null;
  const shown = all ? others : others.slice(0, 3);
  return (
    <View style={styles.row}>
      {shown.map((b) => (
        <Pressable
          key={b.kind}
          onPress={() => explain(name(b), t(`badges.about.${b.kind}`))}
          accessibilityRole="button"
        >
          <BadgeChip kind={b.kind} label={name(b)} />
        </Pressable>
      ))}
      {!all && others.length > 3 ? (
        <Pressable
          onPress={() => setAll(true)}
          accessibilityRole="button"
          style={[styles.more, { backgroundColor: colors.inset }]}
        >
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>
            +{others.length - 3}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  more: { height: 30, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  moreText: { fontFamily: fonts.textBold, fontSize: 12.5 },
});
