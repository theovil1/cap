import { useCallback, useState } from 'react';

import { getValue, setValue } from '@/session/store';

/** Per device, on until the walker closes it: My account brings it back. */
const KEY = 'videoTip';

export function videoTipEnabled(): boolean {
  return getValue<boolean>(KEY) ?? true;
}

export function setVideoTipEnabled(on: boolean): void {
  setValue(KEY, on);
}

/** The iPad tip about watching a video in another app next to the session. */
export function useVideoTip() {
  const [shown, setShown] = useState(videoTipEnabled);
  const hide = useCallback(() => {
    setVideoTipEnabled(false);
    setShown(false);
  }, []);
  return { shown, hide };
}
