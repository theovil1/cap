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
  kind: 'solo' | 'race';
  status: 'invited' | 'waiting' | 'active' | 'finished';
  route_id: string;
  start: Place;
  end: Place;
  route_distance_m: number;
  start_town: string | null;
  end_town: string | null;
  distance_m: number;
  arrived_at: string | null;
  created_at: string;
};

export type JourneyDetail = JourneySummary & {
  path: RoutePoint[];
  stages: (Stage & { unlocked_at: string | null })[];
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
