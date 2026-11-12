/**
 * Development catalogue of the UI kit, to compare it with the mockups
 * (docs/design/maquettes). Open cap://catalog on a development build; release
 * builds go home. The sample words are mockup data, not app copy.
 */
import { Redirect, router } from 'expo-router';
import {
  Bell,
  CalendarDays,
  Flag,
  Footprints,
  MapPin,
  Plus,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useColors } from '@/theme';
import { badges, type BadgeKind } from '@/tokens';
import { Badge, BadgeChip } from '@/ui/badge';
import { EventRow, LiveEventCard, RouteCard, RouteRow } from '@/ui/cards';
import {
  Chip,
  ChipRow,
  SearchBar,
  SectionHeader,
  StepProgress,
  Stepper,
  Tabs,
  TextField,
  Toggle,
} from '@/ui/controls';
import { BravoButton, FeedAttachment, FeedCard } from '@/ui/feed';
import { Grain } from '@/ui/grain';
import { Medal } from '@/ui/medal';
import {
  DeltaPill,
  GlassTag,
  InfoBanner,
  InfoPill,
  LivePill,
  PhotoChip,
  StatusLabel,
  Tag,
} from '@/ui/pills';
import { Avatar, Button, Card, GlassButton, RoundButton } from '@/ui/primitives';
import { Segment } from '@/ui/segment';
import { AvatarStack, CountTile, RankCard, RankRow, StatTile } from '@/ui/stats';

const WALKERS = [
  { id: 'c', name: 'Camille' },
  { id: 'n', name: 'Nadia' },
  { id: 'm', name: 'Marc' },
  { id: 'l', name: 'Léa' },
  { id: 'y', name: 'Yanis' },
];

/** A flat sky and hills standing in for the city pictures of the mockups. */
function Picture({ tone = '#F4935E' }: { tone?: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: tone }]}>
      <View style={[styles.hill, { backgroundColor: '#9A513C' }]} />
    </View>
  );
}

export default function CatalogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'routes' | 'planned'>('routes');
  const [chip, setChip] = useState('popular');
  const [search, setSearch] = useState('');
  const [planned, setPlanned] = useState(true);
  const [height, setHeight] = useState(176);
  const [bravo, setBravo] = useState(false);
  const [segment, setSegment] = useState(3);
  if (!__DEV__) return <Redirect href="/" />;

  const title = (text: string) => (
    <Text style={[styles.title, { color: colors.textSecondary }]}>{text}</Text>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.row}>
          <Text style={[styles.h1, { color: colors.text }]}>Catalogue</Text>
          <RoundButton
            icon={<X size={20} color={colors.text} />}
            onPress={() => router.back()}
            label="Fermer"
          />
        </View>

        {title('Boutons')}
        <Button
          tone="accent"
          title="Démarrer ce trajet"
          icon={<Flag size={20} color={colors.onAccent} />}
          onPress={() => {}}
        />
        <Button tone="dark" title="Continuer" onPress={() => {}} />
        <Button tone="light" title="Continuer avec un e-mail" onPress={() => {}} />
        <View style={styles.row}>
          <Button
            tone="blue"
            size="medium"
            title="Suivre"
            icon={<Plus size={18} color="#FFFFFF" />}
            onPress={() => {}}
            style={styles.flex}
          />
          <Button
            tone="light"
            size="medium"
            title="Défier"
            icon={<Flag size={18} color={colors.text} />}
            onPress={() => {}}
            style={styles.flex}
          />
        </View>
        <View style={styles.row}>
          <RoundButton
            icon={<Plus size={20} color={colors.text} />}
            onPress={() => {}}
            label="Publier"
          />
          <RoundButton
            icon={<Bell size={20} color={colors.text} />}
            onPress={() => {}}
            label="Notifications"
          />
          <GlassButton
            icon={<MapPin size={20} color={colors.text} />}
            onPress={() => {}}
            label="Carte"
          />
        </View>

        {title('Navigation et filtres')}
        <Tabs
          options={[
            { value: 'routes', label: 'Trajets' },
            { value: 'planned', label: 'Planifiés', dot: true },
          ]}
          value={tab}
          onChange={setTab}
        />
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Une ville, un trajet, un marcheur"
          onFilters={() => {}}
          filtersLabel="Filtres"
        />
        <ChipRow>
          {['popular', 'near', 'new', 'short', 'mountain'].map((key) => (
            <Chip key={key} label={key} on={chip === key} onPress={() => setChip(key)} />
          ))}
        </ChipRow>
        <Segment
          options={[2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
          value={segment}
          onChange={setSegment}
        />
        <SectionHeader title="Les plus suivis" action="Tout voir" onAction={() => {}} />
        <View style={styles.row}>
          <StepProgress step={2} total={7} label="Étape 2 sur 7" />
        </View>

        {title('Pastilles')}
        <View style={styles.wrap}>
          <Tag label="Trajet de la semaine" icon={Sparkles} />
          <GlassTag label="Trajet de la semaine" icon={Sparkles} />
          <LivePill label="EN DIRECT" />
          <LivePill label="1 248" large />
          <StatusLabel label="J2 marche" />
        </View>
        <View style={[styles.photo, { backgroundColor: '#9A513C' }]}>
          <Grain on="picture" />
          <PhotoChip label="Départ · Orléans" icon={MapPin} />
          <View
            style={[styles.wrap, { backgroundColor: colors.accent, padding: 10, borderRadius: 16 }]}
          >
            <DeltaPill label="▲ 1 830" />
          </View>
        </View>
        <InfoPill label="Ta foulée : 73 cm" icon={Footprints} />
        <InfoBanner icon={Bell}>On te prévient la veille et 10 minutes avant le départ.</InfoBanner>

        {title('Formulaires')}
        <TextField label="Titre" defaultValue="De la Sologne à Paris" />
        <TextField
          label="Description"
          multiline
          defaultValue="Forêts de Sologne, la Loire à Orléans, puis la Beauce jusqu’à Paris."
        />
        <Card small style={styles.cardPad}>
          <View style={styles.row}>
            <CalendarDays size={19} color={colors.blueText} />
            <Text style={[styles.flex, { color: colors.text, fontFamily: fonts.textSemiBold }]}>
              Trajet planifié
            </Text>
            <Toggle value={planned} onChange={setPlanned} label="Trajet planifié" />
          </View>
        </Card>
        <Card style={styles.cardPad}>
          <Stepper
            label="Ta taille"
            value={String(height)}
            unit="cm"
            onMinus={() => setHeight((h) => h - 1)}
            onPlus={() => setHeight((h) => h + 1)}
            minusLabel="Moins"
            plusLabel="Plus"
          >
            <InfoPill label={`Ta foulée : ${Math.round(height * 0.415)} cm`} icon={Footprints} />
          </Stepper>
        </Card>

        {title('Chiffres et classements')}
        <View style={styles.row}>
          <StatTile label="Distance" value="117" unit="km" />
          <StatTile label="Marcheurs" value="4 382" />
          <StatTile label="Terminé" value="612" unit="fois" />
        </View>
        <View style={styles.row}>
          <CountTile value="23" label="jours" />
          <CountTile value="14" label="heures" />
          <CountTile value="06" label="min" />
          <CountTile value="41" label="s" />
        </View>
        <RankCard
          label="Ta place dans le monde"
          place="12 408"
          suffix="e"
          detail="Top 9 % · 14,6 km cette semaine"
          delta="▲ 1 830"
        />
        <Card small style={styles.listPad}>
          {WALKERS.slice(0, 3).map((w, index) => (
            <RankRow
              key={w.id}
              first={index === 0}
              rank={index + 1}
              name={w.name}
              detail="France"
              value={(84.2 - index * 4).toFixed(1).replace('.', ',')}
              unit="km"
              avatar={<Avatar name={w.name} seed={w.id} tone="walker" size={36} />}
            />
          ))}
        </Card>
        <RankRow
          compact
          me
          rank={57}
          name="Toi"
          value="6,21"
          unit="km"
          avatar={<Avatar name="Théo" size={30} />}
        />
        <AvatarStack walkers={WALKERS} />

        {title('Badges')}
        <View style={styles.wrap}>
          {(Object.keys(badges) as BadgeKind[]).map((kind) => (
            <Badge key={kind} kind={kind} size={56} label={kind} />
          ))}
        </View>
        <View style={styles.wrap}>
          <BadgeChip kind="team" label="Équipe Cap" />
          <BadgeChip kind="developer" label="Développeur" />
          <Badge kind="certified" size={17} label="Certifié" />
        </View>

        {title('Médailles')}
        <View style={styles.wrap}>
          <Medal
            metal="bronze"
            ribbon="green"
            face={{ kind: 'number', value: '100', unit: 'KM' }}
            label="100 km"
          />
          <Medal
            metal="silver"
            ribbon="blue"
            face={{ kind: 'number', value: '500', unit: 'KM' }}
            label="500 km"
          />
          <Medal
            metal="gold"
            ribbon="cap"
            face={{ kind: 'number', value: '1 000', unit: 'KM' }}
            label="1 000 km"
          />
          <Medal
            metal="cap"
            ribbon="black"
            face={{ kind: 'number', value: '5 000', unit: 'KM' }}
            label="5 000 km"
          />
          <Medal
            metal="bronze"
            ribbon="green"
            face={{ kind: 'icon', icon: 'streak', label: '7 J' }}
            label="7 jours"
          />
          <Medal
            metal="silver"
            ribbon="blue"
            face={{ kind: 'icon', icon: 'podium', label: '2E' }}
            label="Podium"
          />
          <Medal
            metal="bronze"
            ribbon="green"
            face={{ kind: 'icon', icon: 'finish', label: 'FINI' }}
            label="Finisher"
          />
          <Medal
            metal="gold"
            ribbon="cap"
            face={{ kind: 'number', value: '1er', unit: 'PLACE' }}
            label="Vainqueur"
          />
          <Medal metal="locked" ribbon="locked" progress={0.62} label="À débloquer" />
        </View>
        <Medal
          metal="gold"
          ribbon="cap"
          width={128}
          face={{ kind: 'number', value: '1 000', unit: 'KM' }}
          label="1 000 km"
        />

        {title('Cartes')}
        <RouteCard
          cover={<Picture />}
          tag="Trajet de la semaine"
          tagIcon={Sparkles}
          caption="Arrivée · Tours"
          captionIcon={Flag}
          title="La Loire à pied : Orléans → Tours"
          subtitle="Trajet de la semaine · 6 étapes · châteaux et bords de Loire"
          distance="117 km"
          walkers="4 382 marcheurs"
          onPress={() => {}}
        />
        <RouteRow
          cover={<Picture tone="#F2C27A" />}
          title="Blois → Amboise"
          subtitle="Les châteaux de la Loire · facile"
          distance="38 km"
          walkers="2 140 marcheurs"
          onPress={() => {}}
        />
        <LiveEventCard
          cover={<Picture tone="#8FA3C7" />}
          live="EN DIRECT"
          walkers={WALKERS.slice(0, 4)}
          walking="1 248 marchent en ce moment"
          title="Le Marathon d’hiver"
          subtitle="42,2 km · parti il y a 1 h 12"
          action="Rejoindre"
          onPress={() => {}}
        />
        <EventRow
          day="6"
          month="déc"
          title="De la Sologne à Paris"
          subtitle="201 km · départ à 9 h · par Théo"
          walkers={WALKERS.slice(0, 3)}
          people="248 inscrits · tu y es"
          onPress={() => {}}
        />
        <FeedCard
          avatar={<Avatar name="Camille" seed="c" tone="walker" size={40} />}
          name="Camille R."
          badge={<Badge kind="supporter" size={17} label="Soutien" />}
          when="Il y a 25 min"
          text="Arrivée à Tours après 41 jours. Merci pour les encouragements !"
          attachment={
            <FeedAttachment
              visual={
                <Medal
                  metal="gold"
                  ribbon="cap"
                  width={42}
                  face={{ kind: 'icon', icon: 'finish', label: '' }}
                  label="Orléans → Tours"
                />
              }
              title="Orléans → Tours"
              detail="117 km · 26 séances · 41 jours"
            />
          }
          bravo={
            <BravoButton
              label={`Bravo · ${bravo ? 49 : 48}`}
              given={bravo}
              onPress={() => setBravo((b) => !b)}
            />
          }
          comments="12"
          onComments={() => {}}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 19, gap: 12 },
  h1: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -1.1, flex: 1 },
  title: {
    fontFamily: fonts.textBold,
    fontSize: 11.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  cardPad: { padding: 16 },
  listPad: { paddingVertical: 2 },
  photo: {
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    justifyContent: 'space-between',
  },
  hill: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -60,
    height: 120,
    borderRadius: 200,
  },
});
