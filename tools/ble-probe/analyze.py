"""Analyze a probe.py recording: FTMS, FitShow and console readings side by side,
plus the integrated speed at every distance counter change.

Usage: .venv\\Scripts\\python analyze.py recordings\\frames-XXXX.csv [interval_s]
"""

from __future__ import annotations

import csv
import json
import sys

import ftms

FFF1 = "0000fff1-0000-1000-8000-00805f9b34fb"


def decode_fitshow(b: bytes) -> dict | None:
    """FitShow 0x51 status frame received on 0xFFF1 (see README.md)."""
    if len(b) < 5 or b[0] != 0x02 or b[-1] != 0x03 or b[1] != 0x51:
        return None
    xor = 0
    for x in b[1:-2]:
        xor ^= x
    out = {"state": b[2], "checksum_ok": xor == b[-2]}
    if b[2] == 0x03 and len(b) >= 17:
        p = b[3:-2]
        out.update({
            "speed_kmh": p[0] / 10,
            "incline_pct": p[1],
            "time_s": p[2] | p[3] << 8,
            "distance_m": p[4] | p[5] << 8,
            "calories_tenths": p[6] | p[7] << 8,
            "steps": p[8] | p[9] << 8,
            "rest": bytes(p[10:]).hex(" "),
        })
    elif len(b) > 5:
        out["payload"] = bytes(b[3:-2]).hex(" ")
    return out


def main() -> None:
    path = sys.argv[1]
    interval = float(sys.argv[2]) if len(sys.argv) > 2 else 10
    last_print = -1e9
    ftms_d = fitshow = None
    integrated = 0.0
    prev = None
    last_distance = None
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            t = float(row["t_s"])
            if row["kind"] in ("step_start", "console", "step_skipped"):
                print(f"\n{t:7.1f} s  >>> {row['kind']} {row['step']} {row['decoded']}")
                continue
            if row["kind"] != "frame":
                continue
            b = bytes.fromhex(row["bytes_hex"])
            uuid = row["characteristic"]
            if uuid == ftms.TREADMILL_DATA and not b[0] & 1:
                ftms_d = ftms.decode_treadmill_data(b)
                if prev:
                    integrated += prev[1] / 3.6 * (t - prev[0])
                prev = (t, ftms_d["speed_kmh"])
                if ftms_d.get("distance_m") != last_distance:
                    last_distance = ftms_d.get("distance_m")
                    print(f"{t:7.1f} s  ** distance counter now {last_distance} m,"
                          f" integrated speed {integrated:.1f} m")
            elif uuid == FFF1:
                fitshow = decode_fitshow(b)
            if t - last_print >= interval and ftms_d:
                last_print = t
                print(f"{t:7.1f} s  FTMS {ftms_d.get('speed_kmh'):5.2f} km/h"
                      f"  {ftms_d.get('distance_m'):5} m"
                      f"  incline {ftms_d.get('incline_pct'):4.1f}"
                      f"  {ftms_d.get('energy_kcal'):3} kcal"
                      f"  {ftms_d.get('elapsed_s'):4} s"
                      f"  | FitShow {json.dumps(fitshow)}")
    print(f"\nIntegrated distance at the end: {integrated:.1f} m")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
