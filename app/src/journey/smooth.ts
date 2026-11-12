import { useEffect, useRef, useState } from 'react';

/** Beyond this gap the pawn jumps (new journey, reset) instead of gliding. */
const SNAP_M = 30;
/** Time to absorb the gap with the real distance. */
const CATCH_UP_S = 0.8;
/** The treadmill speaks about once a second: never guess further than this. */
const MAX_GUESS_S = 2;

/**
 * One animation step of the shown distance. Between two treadmill frames the
 * pawn keeps walking at the current speed, then eases onto the real distance.
 * It never steps back for a small gap, so it does not jitter.
 */
export function smoothStep(
  shownM: number,
  targetM: number,
  targetAgeS: number,
  speedMps: number,
  dtS: number,
): number {
  const expected = targetM + speedMps * Math.min(targetAgeS, MAX_GUESS_S);
  if (Math.abs(expected - shownM) > SNAP_M) return expected;
  const walked = shownM + speedMps * dtS;
  const next = walked + (expected - walked) * Math.min(1, dtS / CATCH_UP_S);
  return Math.max(shownM, next);
}

/** Distance updated about 30 times a second from a value that moves once a second. */
export function useSmoothDistance(targetM: number, speedMps: number): number {
  const [shown, setShown] = useState(targetM);
  // `at` is set by the effect below on the first render.
  const latest = useRef({ targetM, speedMps, at: 0, shownM: targetM, sentM: targetM });
  useEffect(() => {
    latest.current.targetM = targetM;
    latest.current.at = Date.now();
  }, [targetM]);
  useEffect(() => {
    latest.current.speedMps = speedMps;
  }, [speedMps]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let sentAt = 0;
    const tick = (now: number) => {
      const s = latest.current;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      s.shownM = smoothStep(s.shownM, s.targetM, (Date.now() - s.at) / 1000, s.speedMps, dt);
      if (now - sentAt >= 33 && Math.abs(s.shownM - s.sentM) > 0.005) {
        s.sentM = s.shownM;
        sentAt = now;
        setShown(s.shownM);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return shown;
}
