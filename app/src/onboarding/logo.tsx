import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Path } from 'react-native-svg';

import { useColors } from '@/theme';
import { Grain } from '@/ui/grain';

/** The tapir of the Tapiroute logo kit (marque/tapir-fond-orange.svg). */
const BODY =
  'M176 506C172 390 256 312 384 304C486 298 566 314 632 340C640 302 664 270 688 278C708 286 706 324 698 348C752 360 802 394 840 442C864 472 884 508 882 548C881 574 850 582 838 560C830 542 818 522 800 524C780 526 772 550 752 568C730 586 704 592 680 588C692 640 720 700 740 762C746 790 736 806 716 806L654 806C636 806 630 792 630 776C624 724 606 680 588 644C540 662 452 664 402 648C400 700 378 744 362 776C356 798 346 806 330 806L262 806C244 806 236 792 240 776C250 730 240 690 222 652C196 610 178 560 176 506Z';
const SADDLE = 'M344 250C366 400 382 540 414 720L556 720C560 560 604 400 596 250Z';
const INK = '#1A0E08';
const CREAM = '#F7EFE6';

/**
 * The app's square logo, as on its icon: the tapir on the accent, with its
 * grain. Also the team's picture. (`Cap` is the code name.)
 */
export function CapLogo({ size }: { size: number }) {
  const colors = useColors();
  const width = size * 0.75;
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size * 0.3125, backgroundColor: colors.accent },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Grain on="accent" />
      <Svg width={width} height={(width * 588) / 766} viewBox="146 248 766 588">
        <Defs>
          <ClipPath id="tapir-body">
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        <Path d={BODY} fill={INK} />
        <Path d={SADDLE} fill={CREAM} clipPath="url(#tapir-body)" />
        <Circle cx={772} cy={442} r={13} fill={CREAM} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
