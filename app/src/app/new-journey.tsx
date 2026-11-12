import { Camera, Map, ViewAnnotation, type MapRef } from '@maplibre/maplibre-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowUpDown,
  ChevronLeft,
  Footprints,
  Flag,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import { useCreateRoute, useGeocode, useJourneys } from '@/api/queries';
import type { GeocodeResult, Place } from '@/api/types';
import { formatKm, formatNumber } from '@/i18n/format';
import { ideasFrom } from '@/journey/ideas';
import { DEFAULT_SESSION_M } from '@/journey/progress';
import { useMapStyle } from '@/map/style';
import { fonts, useColors } from '@/theme';
import { SectionHeader } from '@/ui/controls';
import { useWide } from '@/ui/layout';
import { Button, Card, Glass, GlassButton } from '@/ui/primitives';

type Field = 'start' | 'end';
const FRANCE: [number, number] = [2.35, 46.6];

export default function NewJourneyScreen() {
  // A challenge from a profile: the friend to race against.
  const { with: rival } = useLocalSearchParams<{ with?: string }>();
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const [places, setPlaces] = useState<Record<Field, Place | null>>({ start: null, end: null });
  const [texts, setTexts] = useState<Record<Field, string>>({ start: '', end: '' });
  const [focused, setFocused] = useState<Field | null>(null);
  const [picking, setPicking] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createRoute = useCreateRoute();
  const { data: journeys = [] } = useJourneys();
  const lastArrival =
    journeys.find((j) => j.status === 'finished')?.end ?? journeys[0]?.end ?? null;

  const near = places.start ?? places.end;
  const query = focused ? texts[focused] : '';
  const results = useGeocode(focused && !places[focused] ? query : '', near, i18n.language);
  const searching = !!focused && !places[focused];
  const ideas = places.start && !searching ? ideasFrom(places.start) : [];

  const choose = (field: Field, place: Place) => {
    setPlaces((p) => ({ ...p, [field]: place }));
    setTexts((s) => ({ ...s, [field]: place.label }));
    setFocused(null);
  };

  const swap = () => {
    setPlaces((p) => ({ start: p.end, end: p.start }));
    setTexts((s) => ({ start: s.end, end: s.start }));
  };

  const showRoute = () => {
    if (!places.start || !places.end) return;
    setError(null);
    createRoute.mutate(
      { start: places.start, end: places.end },
      {
        onSuccess: (route) =>
          router.push({
            pathname: '/preview',
            params: rival ? { routeId: route.id, with: rival } : { routeId: route.id },
          }),
        onError: (e) =>
          setError(
            e instanceof ApiError
              ? t(`errors.${e.code}`, { defaultValue: t('errors.generic') })
              : t('errors.network'),
          ),
      },
    );
  };

  if (picking) {
    return (
      <MapPicker
        center={
          places[picking]
            ? [places[picking].lon, places[picking].lat]
            : near
              ? [near.lon, near.lat]
              : FRANCE
        }
        zoomed={!!(places[picking] ?? near)}
        onCancel={() => setPicking(null)}
        onPick={(place) => {
          choose(picking, place);
          setPicking(null);
        }}
      />
    );
  }

  const input = (field: Field) => (
    <View style={styles.inputRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          {t(`newJourney.${field}`)}
        </Text>
        <TextInput
          value={texts[field]}
          onFocus={() => setFocused(field)}
          onChangeText={(text) => {
            setTexts((s) => ({ ...s, [field]: text }));
            setPlaces((p) => ({ ...p, [field]: null }));
          }}
          placeholder={t(`newJourney.${field}Placeholder`)}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          numberOfLines={1}
          autoCorrect={false}
        />
      </View>
    </View>
  );

  const form = (
    <KeyboardAvoidingView
      behavior="padding"
      style={[{ flex: 1, backgroundColor: colors.background }, wide && styles.formWide]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: 140 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <View style={styles.header}>
            <GlassButton
              icon={<ChevronLeft size={22} color={colors.text} />}
              onPress={router.back}
              label={t('common.back')}
            />
            <Text style={[styles.title, { color: colors.text }]}>{t('newJourney.title')}</Text>
          </View>

          <Card style={styles.fields}>
            <View style={styles.markers}>
              <View style={[styles.startMark, { borderColor: colors.accent }]} />
              <View style={[styles.dash, { borderColor: colors.textMuted }]} />
              <View style={[styles.endMark, { backgroundColor: colors.blue }]} />
            </View>
            <View style={{ flex: 1 }}>
              {input('start')}
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              {input('end')}
            </View>
            <Pressable
              onPress={swap}
              style={[styles.swap, { backgroundColor: colors.inset }]}
              accessibilityLabel={t('newJourney.swap')}
            >
              <ArrowUpDown size={20} color={colors.text} />
            </Pressable>
          </Card>

          <View style={styles.shortcuts}>
            <Pressable
              style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setPicking(focused ?? (places.start ? 'end' : 'start'))}
            >
              <MapPin size={18} color={colors.text} />
              <Text style={[styles.pillText, { color: colors.text }]}>{t('newJourney.onMap')}</Text>
            </Pressable>
            {lastArrival && (
              <Pressable
                style={[
                  styles.pill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => choose('start', lastArrival)}
              >
                <Flag size={18} color={colors.text} />
                <Text style={[styles.pillText, { color: colors.text }]}>
                  {t('newJourney.lastArrival')}
                </Text>
              </Pressable>
            )}
          </View>

          {ideas.length > 0 && (
            <View style={styles.ideas}>
              <View style={styles.ideasHeader}>
                <View style={styles.flex}>
                  <SectionHeader title={t('newJourney.ideas')} />
                </View>
                <Text style={[styles.resultDetail, { color: colors.textMuted }]}>
                  {t('newJourney.onFoot')}
                </Text>
              </View>
              {ideas.map((idea, i) => (
                <Pressable
                  key={idea.place.label}
                  onPress={() => choose('end', idea.place)}
                  accessibilityRole="button"
                  style={[
                    styles.result,
                    styles.idea,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.resultIcon, { backgroundColor: colors.surface }]}>
                    <MapPin size={18} color={colors.accentText} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                      {idea.place.label}
                    </Text>
                    <Text style={[styles.resultDetail, { color: colors.textSecondary }]}>
                      {idea.area}
                    </Text>
                  </View>
                  <View style={styles.ideaRight}>
                    <Text style={[styles.ideaKm, { color: colors.text }]}>
                      {formatKm(idea.distanceM, 0)} {t('units.km')}
                    </Text>
                    <Text style={[styles.ideaSessions, { color: colors.textMuted }]}>
                      {t('newJourney.ideaSessions', {
                        count: Math.max(1, Math.round(idea.distanceM / DEFAULT_SESSION_M)),
                        n: formatNumber(
                          Math.max(1, Math.round(idea.distanceM / DEFAULT_SESSION_M)),
                        ),
                      })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {searching && (
            <Card style={styles.results}>
              {results.isFetching && (
                <ActivityIndicator style={{ padding: 16 }} color={colors.textMuted} />
              )}
              {(results.data ?? []).map((r: GeocodeResult, i) => (
                <Pressable
                  key={`${r.place.lat},${r.place.lon},${i}`}
                  onPress={() => choose(focused, r.place)}
                  style={[
                    styles.result,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.resultIcon, { backgroundColor: colors.inset }]}>
                    <MapPin size={18} color={colors.accentText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text
                      style={[styles.resultDetail, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {r.detail}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 12, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.safe}>
            <ShieldCheck size={16} color={colors.success} />
            <Text style={[styles.safeText, { color: colors.textSecondary }]}>
              {t('newJourney.safeRoutes')}
            </Text>
          </View>
          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
          <Button
            title={createRoute.isPending ? t('newJourney.computing') : t('newJourney.showRoute')}
            icon={<RouteIcon size={20} color="#FFFFFF" />}
            onPress={showRoute}
            loading={createRoute.isPending}
            disabled={!places.start || !places.end}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  if (!wide) return form;
  return (
    <View style={styles.wide}>
      {form}
      <PlacesMap start={places.start} end={places.end} />
    </View>
  );
}

/** iPad: the chosen start and arrival on a map, before the route is computed. */
function PlacesMap({ start, end }: { start: Place | null; end: Place | null }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapStyle = useMapStyle();
  const points = [start, end].filter((p): p is Place => !!p);
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  const camera =
    points.length === 2
      ? {
          bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as [
            number,
            number,
            number,
            number,
          ],
          padding: { top: 120, bottom: 80, left: 80, right: 80 },
          duration: 800,
        }
      : points.length === 1
        ? { center: [points[0].lon, points[0].lat] as [number, number], zoom: 9, duration: 800 }
        : { center: FRANCE, zoom: 4.6 };
  return (
    <View style={[styles.flex, { backgroundColor: colors.inset }]}>
      {mapStyle && (
        <Map style={StyleSheet.absoluteFill} mapStyle={mapStyle} logo={false} compass={false}>
          <Camera {...camera} />
          {points.map((p, i) => (
            <ViewAnnotation key={i} id={`place-${i}`} lngLat={[p.lon, p.lat]} anchor="center">
              <View
                style={[
                  styles.placeDot,
                  i === 0 && points.length === 2
                    ? { borderColor: colors.accent }
                    : { borderColor: colors.text },
                  { backgroundColor: colors.surface },
                ]}
              />
            </ViewAnnotation>
          ))}
        </Map>
      )}
      <Glass style={[styles.footChip, { top: insets.top + 20 }]}>
        <Footprints size={16} color={colors.accentText} />
        <Text style={[styles.pillText, { color: colors.text }]}>{t('newJourney.footSafe')}</Text>
      </Glass>
    </View>
  );
}

/** Move the map under the pin, then confirm: the nearest address is looked up. */
function MapPicker({
  center,
  zoomed,
  onPick,
  onCancel,
}: {
  center: [number, number];
  zoomed: boolean;
  onPick: (place: Place) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapStyle = useMapStyle();
  const map = useRef<MapRef>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    const [lon, lat] = (await map.current?.getCenter()) ?? center;
    setBusy(true);
    try {
      const result = await api<GeocodeResult>('/reverse', {
        query: { lat, lon, lang: i18n.language },
      });
      onPick(result.place);
    } catch {
      onPick({ label: t('newJourney.pickedPoint'), lat, lon });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.inset }}>
      {mapStyle && (
        <Map
          ref={map}
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          attribution
          attributionPosition={{ bottom: insets.bottom + 90, left: 8 }}
        >
          <Camera initialViewState={{ center, zoom: zoomed ? 13 : 5 }} />
        </Map>
      )}
      <View pointerEvents="none" style={styles.pinWrap}>
        <MapPin size={40} color={colors.accent} fill={colors.surface} />
      </View>
      <View style={[styles.pickerTop, { top: insets.top + 12 }]}>
        <GlassButton
          icon={<ChevronLeft size={22} color={colors.text} />}
          onPress={onCancel}
          label={t('common.back')}
        />
      </View>
      <View style={[styles.pickerBottom, { bottom: insets.bottom + 16 }]}>
        <Button title={t('newJourney.pickHere')} onPress={confirm} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wide: { flex: 1, flexDirection: 'row' },
  formWide: { flex: 0, width: 470 },
  ideas: { gap: 4, marginTop: 8 },
  ideasHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  idea: { paddingHorizontal: 0 },
  ideaRight: { alignItems: 'flex-end', gap: 2 },
  ideaKm: { fontFamily: fonts.display, fontSize: 16, fontVariant: ['tabular-nums'] },
  ideaSessions: { fontFamily: fonts.text, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  placeDot: { width: 18, height: 18, borderRadius: 99, borderWidth: 3.5 },
  footChip: {
    position: 'absolute',
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
  },
  content: { paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 29, letterSpacing: -0.8 },
  fields: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 12,
  },
  markers: { alignItems: 'center', gap: 4, paddingVertical: 18 },
  startMark: { width: 13, height: 13, borderRadius: 99, borderWidth: 3 },
  dash: { width: 0, height: 30, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  endMark: { width: 13, height: 13, borderRadius: 3 },
  inputRow: { paddingVertical: 8 },
  inputLabel: { fontFamily: fonts.textSemiBold, fontSize: 12.5 },
  input: { fontFamily: fonts.textSemiBold, fontSize: 16.5, padding: 0 },
  separator: { height: 1, marginVertical: 2 },
  swap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcuts: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  results: { paddingHorizontal: 14 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: { fontFamily: fonts.textSemiBold, fontSize: 16 },
  resultDetail: { fontFamily: fonts.text, fontSize: 13 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  safe: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  safeText: { fontFamily: fonts.text, fontSize: 13 },
  error: { fontFamily: fonts.textMedium, fontSize: 14 },
  pinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  pickerTop: { position: 'absolute', left: 20 },
  pickerBottom: { position: 'absolute', left: 20, right: 20 },
});
