import { CapLogo } from '@/onboarding/logo';
import { Avatar } from '@/ui/primitives';

/** The Tapiroute team: a system account of the API that publishes the base routes. */
export const TEAM_ID = '00000000-0000-0000-0000-000000000ca9';

export const isTeam = (id: string) => id === TEAM_ID;

/** A walker's picture, or the app logo (the tapir) for the team. */
export function WalkerAvatar({
  walker,
  size,
  tone = 'walker',
}: {
  walker: { id: string; first_name: string; avatar_url?: string | null };
  size: number;
  tone?: 'walker' | 'accent';
}) {
  if (isTeam(walker.id)) return <CapLogo size={size} />;
  return (
    <Avatar
      name={walker.first_name}
      seed={walker.id}
      photo={walker.avatar_url}
      tone={tone}
      size={size}
    />
  );
}
