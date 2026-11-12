import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ImagePlus, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL, ApiError } from '@/api/client';
import { useCreateEvent, usePublicRoute, usePublish, useRoutePhoto } from '@/api/community';
import { useJourney, useJourneys } from '@/api/queries';
import type { JourneySummary, RoutePhoto } from '@/api/types';
import { pickPhoto } from '@/community/pick-photo';
import { PlanFields, usePlan } from '@/community/plan-fields';
import { formatKm } from '@/i18n/format';
import { journeyTitle } from '@/journey/names';
import { AerialView } from '@/map/aerial';
import { fonts, useColors } from '@/theme';
import { Chip, Tabs, TextField } from '@/ui/controls';
import { Button, Card, RoundButton } from '@/ui/primitives';

const TAGS = ['countryside', 'castles', 'river', 'mountain', 'sea', 'city'] as const;
const KINDS: RoutePhoto['kind'][] = ['start', 'end', 'path'];
/** Photos are sent 1600 px wide, well under the 2 MB the API takes. */
const PHOTO_WIDTH = 1600;

type Picked = Partial<Record<RoutePhoto['kind'], { uri: string; bytes: ArrayBuffer }>>;

/**
 * Publish one of my routes for the community (title, words, who sees it,
 * themes, up to three photos), or add photos to one already published.
 */
export default function PublishScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { publicRouteId } = useLocalSearchParams<{ publicRouteId?: string }>();
  const { data: journeys = [] } = useJourneys();
  // Routes I computed and did not publish yet, the one under way first.
  const mine = journeys
    .filter((j) => j.mine && j.kind === 'solo' && !j.public_route_id)
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const [chosen, setChosen] = useState<string | null>(null);
  const journey = mine.find((j) => j.id === chosen) ?? mine[0] ?? null;
  const { data: published } = usePublicRoute(publicRouteId);
  const publish = usePublish();
  const upload = useRoutePhoto();
  const createEvent = useCreateEvent();
  const [plan, setPlan] = usePlan();
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'friends'>('everyone');
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Picked>({});
  const [busy, setBusy] = useState(false);
  const editing = !!publicRouteId;
  const shownTitle = title ?? (journey ? journeyTitle(journey) : '');

  const add = async (kind: RoutePhoto['kind']) => {
    try {
      const photo = await pickPhoto(PHOTO_WIDTH, kind === 'path' ? [4, 3] : [3, 2]);
      if (!photo) return;
      if (editing && publicRouteId) {
        upload.mutate(
          { id: publicRouteId, kind, image: photo.bytes },
          { onError: () => Alert.alert(t('errors.generic')) },
        );
      } else {
        setPhotos((p) => ({ ...p, [kind]: photo }));
      }
    } catch {
      Alert.alert(t('account.needsUpdate'));
    }
  };

  const submit = () => {
    if (!journey) return;
    setBusy(true);
    publish.mutate(
      { route_id: journey.route_id, title: shownTitle.trim(), description, visibility, tags },
      {
        onSuccess: async (route) => {
          // Photos go one by one once the route exists.
          for (const kind of KINDS) {
            const photo = photos[kind];
            if (photo) {
              await upload.mutateAsync({ id: route.id, kind, image: photo.bytes }).catch(() => {});
            }
          }
          if (plan.on) {
            const event = await createEvent
              .mutateAsync({
                public_route_id: route.id,
                title: shownTitle.trim(),
                starts_at: plan.startsAt.toISOString(),
                ends_at: plan.endsAt.toISOString(),
              })
              .catch(() => null);
            setBusy(false);
            if (event) {
              router.replace({ pathname: '/event/[id]', params: { id: event.id } });
              return;
            }
            Alert.alert(t('plan.failed'));
          }
          setBusy(false);
          router.replace({ pathname: '/public-route/[id]', params: { id: route.id } });
        },
        onError: (error) => {
          setBusy(false);
          Alert.alert(
            error instanceof ApiError && error.code === 'invalid_title'
              ? t('publish.titleRule')
              : t('errors.generic'),
          );
        },
      },
    );
  };

  const photoSlots = (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{t('publish.photos')}</Text>
      <View style={styles.slots}>
        {KINDS.map((kind) => {
          const local = photos[kind]?.uri;
          const remote = published?.photos.find((p) => p.kind === kind)?.url;
          const uri = local ?? (remote ? `${API_URL}${remote}` : null);
          return (
            <Pressable
              key={kind}
              onPress={() => add(kind)}
              accessibilityRole="button"
              accessibilityLabel={t(`publish.kinds.${kind}`)}
              style={[styles.slot, { backgroundColor: colors.surface, borderColor: colors.track }]}
            >
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <ImagePlus size={22} color={colors.textSecondary} />
              )}
              <View style={[styles.slotLabel, { backgroundColor: colors.surface }]}>
                <Text style={[styles.slotText, { color: colors.text }]}>
                  {t(`publish.kinds.${kind}`)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('publish.photosHint')}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <RoundButton
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
            label={t('common.back')}
          />
          <Text style={[styles.title, { color: colors.text }]}>
            {editing ? t('publish.editTitle') : t('publish.title')}
          </Text>
        </View>

        {editing ? (
          published ? (
            <>
              <Text style={[styles.lead, { color: colors.textSecondary }]}>{published.title}</Text>
              {photoSlots}
              {upload.isPending && <ActivityIndicator color={colors.textMuted} />}
            </>
          ) : (
            <ActivityIndicator color={colors.textMuted} />
          )
        ) : !journey ? (
          <Text style={[styles.lead, { color: colors.textSecondary }]}>{t('publish.noRoute')}</Text>
        ) : (
          <>
            {mine.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.choices}
              >
                {mine.map((j) => (
                  <Chip
                    key={j.id}
                    small
                    label={journeyTitle(j)}
                    on={j.id === journey.id}
                    onPress={() => setChosen(j.id)}
                  />
                ))}
              </ScrollView>
            )}
            <RouteSummary journey={journey} />
            <TextField
              label={t('publish.titleLabel')}
              value={shownTitle}
              onChangeText={setTitle}
              maxLength={80}
            />
            <TextField
              label={t('publish.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('publish.descriptionPlaceholder')}
              multiline
              maxLength={600}
            />
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('publish.visibleBy')}
              </Text>
              <Tabs
                options={[
                  { value: 'everyone', label: t('publish.everyone') },
                  { value: 'friends', label: t('publish.friends') },
                ]}
                value={visibility}
                onChange={setVisibility}
              />
            </View>
            <PlanFields plan={plan} onChange={setPlan} />
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('publish.themes')}
              </Text>
              <View style={styles.tags}>
                {TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    small
                    label={t(`publish.tags.${tag}`)}
                    on={tags.includes(tag)}
                    onPress={() =>
                      setTags((list) =>
                        list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag],
                      )
                    }
                  />
                ))}
              </View>
            </View>
            {photoSlots}
          </>
        )}
      </ScrollView>
      {!editing && journey ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 12, backgroundColor: colors.background },
          ]}
        >
          <Button
            tone="accent"
            title={t('publish.submit')}
            icon={<Upload size={19} color={colors.onAccent} />}
            onPress={submit}
            loading={busy}
            disabled={shownTitle.trim().length < 3}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** The route to publish: its destination from the sky, its name and facts. */
function RouteSummary({ journey }: { journey: JourneySummary }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: detail } = useJourney(journey.id);
  const stages = Math.max(0, (detail?.stages.length ?? 1) - 1);
  return (
    <Card small style={styles.summary}>
      <View style={styles.thumb}>
        <AerialView lat={journey.end.lat} lon={journey.end.lon} size={92} zoom={13} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.summaryTitle, { color: colors.text }]} numberOfLines={1}>
          {journeyTitle(journey)}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={2}>
          {t('publish.facts', {
            km: formatKm(journey.route_distance_m, 0),
            stages: t('explore.stages', { count: stages }),
          })}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.8 },
  lead: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 23 },
  label: { fontFamily: fonts.textSemiBold, fontSize: 13 },
  hint: { fontFamily: fonts.text, fontSize: 12.5, lineHeight: 18 },
  choices: { gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10 },
  thumb: { width: 92, height: 92, borderRadius: 16, overflow: 'hidden' },
  summaryTitle: { fontFamily: fonts.display, fontSize: 17 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slots: { flexDirection: 'row', gap: 10 },
  slot: {
    flex: 1,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotLabel: {
    position: 'absolute',
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  slotText: { fontFamily: fonts.textSemiBold, fontSize: 11.5 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
});
