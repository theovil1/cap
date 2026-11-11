import type { JourneySummary } from '@/api/types';
import { shortPlace } from '@/i18n/format';

/** `Romorantin-Lanthenay → Paris`, from the towns or, failing that, the typed places. */
export function journeyTitle(
  journey: Pick<JourneySummary, 'start' | 'end' | 'start_town' | 'end_town'>,
): string {
  const from = journey.start_town ?? shortPlace(journey.start.label);
  const to = journey.end_town ?? shortPlace(journey.end.label);
  return `${from} → ${to}`;
}
