import { Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { fonts, useColors } from '@/theme';
import { TabScreen } from '@/ui/layout';
import { Card } from '@/ui/primitives';

/** Leaderboards come with the multiplayer step. */
export default function RankingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <TabScreen>
      <Text style={[styles.title, { color: colors.text }]}>{t('nav.rankings')}</Text>
      <Card style={styles.card}>
        <Trophy size={28} color={colors.accent} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>{t('rankings.soon')}</Text>
      </Card>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.9, marginBottom: 4 },
  card: { padding: 22, gap: 12, alignItems: 'center' },
  text: { fontFamily: fonts.text, fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
