import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import { usePostSession } from '@/api/community';
import type { SessionPostData } from '@/api/types';
import { SessionCardBody } from '@/community/session-card';
import { fonts, useColors } from '@/theme';
import { InfoBanner } from '@/ui/pills';
import { Segment } from '@/ui/segment';
import { Button, GlassButton } from '@/ui/primitives';

type Audience = 'friends' | 'all';

/** Within this distance of a journey's start or end, the map may show where the walker lives. */
const NEAR_END_M = 500;

/** Posting a session in the feed: its card, a word, and who sees it. */
export default function PostSessionScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ['session-post', id],
    queryFn: () => api<SessionPostData>(`/sessions/${id}/post`),
    enabled: !!id,
  });
  const post = usePostSession();
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<Audience>('friends');

  // The map shows the surroundings of the journey's start or end: maybe a home.
  const journey = data?.journey;
  const nearEnds =
    !!journey && (journey.from_m < NEAR_END_M || journey.route_m - journey.to_m < NEAR_END_M);

  const publish = () =>
    post.mutate(
      { id, text: text.trim() || undefined, audience },
      {
        onSuccess: () => router.back(),
        onError: (error) =>
          Alert.alert(
            error instanceof ApiError && error.code === 'already_posted'
              ? t('sessionPost.already')
              : t('feed.postFailed'),
          ),
      },
    );

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('sessionPost.title')}
          </Text>
          <GlassButton
            icon={<X size={20} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.close')}
          />
        </View>
        {data ? (
          <SessionCardBody data={data} />
        ) : (
          <ActivityIndicator color={colors.textSecondary} />
        )}
        {nearEnds ? <InfoBanner icon={MapPin}>{t('sessionPost.nearEnds')}</InfoBanner> : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('sessionPost.word')}
          placeholderTextColor={colors.textMuted}
          maxLength={280}
          multiline
          style={[styles.input, { color: colors.text, backgroundColor: colors.inset }]}
        />
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('sessionPost.audience')}
          </Text>
          <Segment
            options={[
              { value: 'friends', label: t('sessionPost.friends') },
              { value: 'all', label: t('sessionPost.all') },
            ]}
            value={audience}
            onChange={(v) => setAudience(v as Audience)}
          />
        </View>
        <Button
          tone="accent"
          title={t('sessionPost.publish')}
          onPress={publish}
          loading={post.isPending}
          disabled={!data}
        />
        <Button tone="light" title={t('sessionPost.notNow')} onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  input: { minHeight: 64, borderRadius: 16, padding: 14, fontFamily: fonts.text, fontSize: 15 },
  label: { fontFamily: fonts.textMedium, fontSize: 13 },
});
