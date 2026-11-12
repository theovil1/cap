import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useColors } from '@/theme';
import { type } from '@/tokens';
import { StepProgress } from '@/ui/controls';
import { Grain } from '@/ui/grain';
import { useWide } from '@/ui/layout';
import { RoundButton } from '@/ui/primitives';

import { SidePanel, type SideRow } from './side-panel';

/** Steps after the welcome screen: "Étape 1 sur 7" to "Étape 7 sur 7". */
export const STEPS = 7;

/** What every step passes to its frame. */
export type FrameNav = {
  /** 1 to 7. */
  step: number;
  onBack: () => void;
  /** Missing on the last step. */
  onSkip?: () => void;
  side: SideRow[];
};

/** Small red kicker, big title and one paragraph at the top of each step. */
export function Headline({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.headline}>
      <Text style={[styles.kicker, { color: colors.accentText }]}>{kicker}</Text>
      <Text style={[type.largeTitle, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

/**
 * One onboarding step: back, progress and "Passer" on top, the content, the
 * call to action at the bottom. On iPad the map and the checklist of the
 * steps stay on the left.
 */
export function OnboardingFrame({
  step,
  onBack,
  onSkip,
  side,
  children,
  footer,
}: FrameNav & { children: ReactNode; footer: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();

  const column = (
    <View
      style={[
        styles.column,
        wide
          ? [styles.columnWide, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 36 }]
          : {
              paddingTop: insets.top + 6,
              paddingBottom: Math.max(insets.bottom, 20),
              paddingHorizontal: 22,
            },
      ]}
    >
      <View style={[styles.header, wide && styles.headerWide]}>
        <RoundButton
          icon={<ChevronLeft size={22} color={colors.text} strokeWidth={2} />}
          onPress={onBack}
          label={t('common.back')}
          plain={!wide}
        />
        <StepProgress
          step={step}
          total={STEPS}
          label={t('onboarding.step', { step, total: STEPS })}
        />
        {onSkip ? (
          <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={10} style={styles.skip}>
            <Text
              style={[styles.skipText, wide && styles.skipWide, { color: colors.textSecondary }]}
            >
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.skip} />
        )}
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Grain />
      {wide ? (
        <View style={styles.row}>
          <SidePanel rows={side} />
          <View style={styles.right}>{column}</View>
        </View>
      ) : (
        column
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  right: { flex: 1, paddingLeft: 40, alignItems: 'center' },
  column: { flex: 1, gap: 22 },
  columnWide: { width: '100%', maxWidth: 460 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerWide: { gap: 12 },
  skip: { width: 70, alignItems: 'flex-end' },
  skipText: { fontFamily: fonts.textSemiBold, fontSize: 14.5 },
  skipWide: { fontSize: 15 },
  body: { flexGrow: 1, gap: 22 },
  footer: { gap: 22 },
  headline: { gap: 10 },
  kicker: { fontFamily: fonts.textBold, fontSize: 13.5, letterSpacing: 0.27 },
  text: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 23 },
});
