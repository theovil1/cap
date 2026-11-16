import { router } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chooseSensor, forgetSensor, scanSensors, useHeart } from '@/heart/monitor';
import { useOnboarding } from '@/onboarding/state';
import { fonts, useColors } from '@/theme';
import { GlassButton } from '@/ui/primitives';

/** My account > Heart rate sensors: pair a strap or a watch that broadcasts its heart rate. */
export default function SensorsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bluetooth } = useOnboarding();
  const { sensor, connected, bpm } = useHeart();
  const [nearby, setNearby] = useState<Device[]>([]);

  useEffect(() => {
    if (!bluetooth) return;
    return scanSensors((device) =>
      setNearby((list) => (list.some((d) => d.id === device.id) ? list : [...list, device])),
    );
  }, [bluetooth]);
  const others = nearby.filter((d) => d.id !== sensor?.id);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <GlassButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('heart.sensors')}</Text>
        </View>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('heart.intro')}</Text>

        {sensor && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>{t('heart.mine')}</Text>
            <View style={[styles.mine, { backgroundColor: colors.surface }]}>
              <View style={[styles.icon, { backgroundColor: colors.heartSoft }]}>
                <Heart size={20} color={colors.heart} fill={colors.heart} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {sensor.name || t('heart.unnamed')}
                </Text>
                <View style={styles.inline}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: connected ? colors.success : colors.textMuted },
                    ]}
                  />
                  <Text
                    style={[
                      styles.status,
                      { color: connected ? colors.success : colors.textSecondary },
                    ]}
                  >
                    {connected
                      ? bpm !== null
                        ? t('heart.connectedBpm', { bpm })
                        : t('heart.connected')
                      : t('heart.notConnected')}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={forgetSensor}
                accessibilityRole="button"
                style={[styles.pill, { backgroundColor: colors.inset }]}
              >
                <Text style={[styles.pillText, { color: colors.danger }]}>{t('heart.forget')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              {t('heart.nearby')}
            </Text>
            <Text style={[styles.searching, { color: colors.textMuted }]}>
              {bluetooth ? t('heart.searching') : t('heart.bluetoothOff')}
            </Text>
          </View>
          {others.length > 0 && (
            <View style={[styles.list, { backgroundColor: colors.surface }]}>
              {others.map((device, i) => (
                <View
                  key={device.id}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderColor: colors.inset }]}
                >
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                    {device.localName ?? device.name ?? t('heart.unnamed')}
                  </Text>
                  <Pressable
                    onPress={() => chooseSensor(device)}
                    accessibilityRole="button"
                    style={[styles.pill, { backgroundColor: colors.inverse }]}
                  >
                    <Text style={[styles.pillText, { color: colors.onInverse }]}>
                      {t('heart.pair')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.note, { backgroundColor: colors.blueSoft }]}>
          <Text style={[styles.noteText, { color: colors.blueText }]}>{t('heart.note')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6, flexShrink: 1 },
  intro: { fontFamily: fonts.text, fontSize: 14.5, lineHeight: 22 },
  section: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searching: { fontFamily: fonts.text, fontSize: 12.5 },
  mine: {
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontFamily: fonts.text, fontSize: 13 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  pillText: { fontFamily: fonts.textSemiBold, fontSize: 13.5 },
  list: { borderRadius: 22, overflow: 'hidden' },
  row: {
    minHeight: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowName: { flex: 1, fontFamily: fonts.text, fontSize: 15.5 },
  note: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  noteText: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 20 },
});
