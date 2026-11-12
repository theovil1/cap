import { Map as MapIcon, Satellite } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/theme';
import { GlassButton } from '@/ui/primitives';

import { setMapKind, useMapKind } from './style';

/** Switches every map between the plan and the aerial photos. */
export function MapKindButton() {
  const { t } = useTranslation();
  const colors = useColors();
  const kind = useMapKind();
  const satellite = kind === 'satellite';
  return (
    <GlassButton
      icon={
        satellite ? (
          <MapIcon size={21} color={colors.text} />
        ) : (
          <Satellite size={21} color={colors.text} />
        )
      }
      onPress={() => setMapKind(satellite ? 'plan' : 'satellite')}
      label={t(satellite ? 'map.plan' : 'map.satellite')}
    />
  );
}
