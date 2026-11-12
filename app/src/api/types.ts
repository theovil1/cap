/** Shapes returned by the Cap API (see https://cap.theovilain.fr/docs). */
import type { RoutePoint } from '@/journey/route';

export type Place = { label: string; lat: number; lon: number };

export type UserProfile = {
  id: string;
  email: string | null;
  first_name: string;
  username: string;
  avatar_url: string | null;
  country: string;
  home_city: string | null;
  height_cm: number | null;
  stride_cm: number | null;
  daily_step_goal: number;
  sessions_per_week: number;
  language: 'fr' | 'en';
  app_color: 'orange' | 'blue' | 'green' | 'purple' | 'pink';
  map_mood: 'auto' | 'day' | 'night';
  units: 'km' | 'mi';
  notifications: boolean;
  /** `everyone`: found by the start of the username; `friends`: exact username or link only. */
  visibility: 'everyone' | 'friends';
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserProfile;
};

export type GeocodeResult = { name: string; detail: string; place: Place };

export type Stage = {
  id: string;
  position: number;
  name: string;
  county: string | null;
  lat: number;
  lon: number;
  at_m: number;
};

export type RouteDetail = {
  id: string;
  start: Place;
  end: Place;
  distance_m: number;
  path: RoutePoint[];
  stages: Stage[];
};

export type JourneySummary = {
  id: string;
  kind: 'solo' | 'race' | 'event';
  /** `waiting`: a race not started yet. */
  status: 'waiting' | 'active' | 'finished';
  /** False while invited to a race. */
  joined: boolean;
  /** Created by the current user. */
  mine: boolean;
  players: number;
  starts_at: string | null;
  /** Arrival order of the current user in a race. */
  rank: number | null;
  route_id: string;
  start: Place;
  end: Place;
  route_distance_m: number;
  start_town: string | null;
  end_town: string | null;
  distance_m: number;
  /** Sessions that counted for this journey (sent since the API of 12 Nov 2026). */
  sessions?: number;
  /** The public route it was started from, or published as. */
  public_route_id?: string | null;
  /** Title and end of a scheduled journey. */
  title?: string | null;
  ends_at?: string | null;
  arrived_at: string | null;
  created_at: string;
};

export type LivePosition = { distance_m: number; speed_kmh: number };

export type Participant = {
  user_id: string;
  first_name: string;
  username: string;
  me: boolean;
  joined: boolean;
  distance_m: number;
  arrived_at: string | null;
  rank: number | null;
  last_session_at: string | null;
  /** Set while they walk right now. */
  live: LivePosition | null;
};

export type JourneyDetail = JourneySummary & {
  path: RoutePoint[];
  stages: (Stage & { unlocked_at: string | null })[];
  participants: Participant[];
};

export type SessionUpload = {
  local_id: string;
  started_at: string;
  ended_at: string;
  distance_m: number;
  duration_s: number;
  steps: number;
  avg_incline_pct: number;
  source: 'treadmill' | 'manual';
  journey_ids?: string[];
};

export type Allocation = {
  journey_id: string;
  distance_m: number;
  total_m: number;
  arrived: boolean;
  unlocked_stages: Stage[];
};

export type SessionResult = { id: string; created: boolean; allocations: Allocation[] };

export type SessionItem = {
  id: string;
  local_id: string;
  started_at: string;
  ended_at: string;
  distance_m: number;
  duration_s: number;
  steps: number;
  avg_speed_kmh: number;
  avg_incline_pct: number;
  source: 'treadmill' | 'manual';
};

export type Friend = {
  id: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
  since: string;
};

export type FriendList = { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] };

export type AddFriendResult = { status: 'pending' | 'accepted'; friend: Friend };

export type UserMatch = {
  id: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
  relation: 'none' | 'friend' | 'incoming' | 'outgoing';
};

export type LeaderboardPeriod = 'week' | 'month' | 'all' | 'streak';
export type LeaderboardScope = 'friends' | 'country' | 'world';

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
  country: string;
  me: boolean;
  /** Metres (week, month, all) or days in a row (streak). */
  value: number;
  best: number | null;
};

export type Leaderboard = {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  starts_on: string;
  ends_on: string;
  /** Walkers ranked; the first fifty come in `entries` out of the friends. */
  total: number;
  country: string;
  entries: LeaderboardEntry[];
  /** My row, even outside the first fifty. */
  me: LeaderboardEntry | null;
  /** My rank over the previous week or month. */
  previous_rank: number | null;
};

/** A walker as shown next to what they did. */
export type Walker = {
  id: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
};

export type RoutePhoto = { kind: 'start' | 'end' | 'path'; url: string };

export type PublicRouteCard = {
  id: string;
  route_id: string;
  title: string;
  description: string;
  author: Walker;
  visibility: 'everyone' | 'friends';
  tags: string[];
  start: Place;
  end: Place;
  start_town: string | null;
  end_town: string | null;
  distance_m: number;
  stages: number;
  walkers: number;
  finished: number;
  photos: RoutePhoto[];
  featured: boolean;
  created_at: string;
};

export type Fastest = {
  rank: number;
  walker: Walker;
  walking_s: number;
  sessions: number;
  arrived_at: string;
};

export type PublicRouteDetail = PublicRouteCard & {
  path: RoutePoint[];
  stage_list: Stage[];
  fastest: Fastest[];
  my_journey_id: string | null;
  mine: boolean;
};

export type PublicRouteSort = 'popular' | 'new' | 'near';

export type EventState = 'upcoming' | 'live' | 'ended';

/** A scheduled journey ("trajet planifié"). */
export type EventCard = {
  id: string;
  title: string;
  public_route_id: string;
  state: EventState;
  starts_at: string;
  ends_at: string;
  organizer: Walker;
  start: Place;
  end: Place;
  start_town: string | null;
  end_town: string | null;
  distance_m: number;
  stages: number;
  photo_url: string | null;
  registered: number;
  walking_now: number;
  friends: Walker[];
  friends_registered: number;
  me_registered: boolean;
};

export type Standing = {
  rank: number;
  walker: Walker;
  distance_m: number;
  friend: boolean;
  speed_kmh: number | null;
  arrived_at: string | null;
};

export type LiveStandings = {
  registered: number;
  walking_now: number;
  route_distance_m: number;
  me: Standing | null;
  my_rank_before: number | null;
  leaders: Standing[];
  friends: Standing[];
  others_m: number[];
};

export type FinishedJourney = {
  id: string;
  kind: 'solo' | 'race' | 'event';
  title: string | null;
  start: Place;
  end: Place;
  start_town: string | null;
  end_town: string | null;
  route_distance_m: number;
  arrived_at: string;
  rank: number | null;
};

export type PublicProfile = {
  walker: Walker;
  home_city: string | null;
  country: string;
  created_at: string;
  total_m: number;
  finished: number;
  best_streak: number;
  streak: number;
  followers: number;
  following: number;
  relation: 'me' | 'friend' | 'incoming' | 'outgoing' | 'none';
  i_follow: boolean;
  follows_me: boolean;
  mutual_friends: number;
  mutual_names: string[];
  journeys: FinishedJourney[];
  under_way: {
    id: string;
    title: string | null;
    start: Place;
    end: Place;
    start_town: string | null;
    end_town: string | null;
    distance_m: number;
    route_distance_m: number;
    path: RoutePoint[];
  } | null;
};

export type FeedKind = 'arrived' | 'stage' | 'medal' | 'published';

/** A post of the feed; `data` depends on the kind. */
export type FeedPost = {
  id: string;
  author: Walker;
  kind: FeedKind;
  data: {
    title?: string;
    kind?: 'solo' | 'race' | 'event';
    distance_m?: number;
    sessions?: number;
    days?: number;
    rank?: number | null;
    end_town?: string | null;
    end?: { lat: number; lon: number };
    stage?: string;
    position?: number;
    stages?: number;
    medal?: 'distance' | 'streak';
    km?: number;
    public_route_id?: string;
  };
  journey_id: string | null;
  text: string | null;
  bravos: number;
  i_bravo: boolean;
  comments: number;
  mine: boolean;
  created_at: string;
};

export type Comment = {
  id: string;
  author: Walker;
  text: string;
  mine: boolean;
  created_at: string;
};
