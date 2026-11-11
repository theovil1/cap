# BLE probe

Python tools used to reverse-engineer a treadmill's Bluetooth protocol from a PC, before writing any app code. They produced the Zipro Luma reference below, and can be reused to document any other treadmill.

| File | Purpose |
| --- | --- |
| `probe.py` | Scans, lists services and characteristics, subscribes to every notification and records frames to CSV during a guided session (stopped, 2 km/h, 4 km/h, incline, stopped). |
| `analyze.py` | Prints FTMS, FitShow and console readings side by side, and compares the distance counter with the integrated speed. |
| `ftms.py` | FTMS decoders (Treadmill Data, Feature, speed and inclination ranges). |
| `recordings/` | Reference recording of the Zipro Luma (11 Nov 2026). |

## Usage

Requires Python 3.12+ and a Bluetooth LE adapter. Close any other app connected to the treadmill first: most treadmills accept a single connection.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # .venv/bin/python on macOS and Linux
.venv/Scripts/python probe.py                          # scan, then pick the treadmill
.venv/Scripts/python probe.py --address 08:FD:F8:AE:4E:D0 --inventory-only
.venv/Scripts/python analyze.py recordings/frames-20261111-140957.csv
```

CSV columns: `timestamp, t_s, step, kind, characteristic, name, bytes_hex, decoded`. `kind` is `frame`, `read`, `console` (what the user read on the console), `step_start`, `step_end`, etc.

## Zipro Luma protocol

### Summary

- Standard **FTMS** (service `0x1826`). Treadmill Data (`0x2ACD`) is notified about once per second, with no initialisation command.
- Speed and incline match the console exactly.
- **Distance only moves in 100 m steps** (the console shows 0.1 km). Cap therefore integrates the speed and re-anchors on the counter (see below).
- No step count and no heart rate: those fields stay at zero.
- The Bluetooth module is a FitShow `FS-BT-T4`, which also speaks a proprietary protocol on `0xFFF0` with the same data and precision.

### Device

| Item | Value |
| --- | --- |
| Advertised name | `FS-8274AD` (`FS-` prefix shared by FitShow modules) |
| Advertised services | `0xFFF0`, `0x1826` |
| Manufacturer / model (`0x2A29` / `0x2A24`) | `FITSHOW` / `FS-BT-T4` |
| Firmware / software / hardware | `V2.6.3` / `1.4.2` / `1.0` |
| MTU | 508 |

On iOS the MAC address is hidden: match on the `FS-` name and the advertised `0x1826` service. The Device Information service also contains misused UUIDs (`0x2A51`, `0x2A5D` return the MAC, `0x2A46` returns `FS-Update_1.0`): ignore them.

### GATT table

| Service | Characteristic | Properties | Observed behaviour |
| --- | --- | --- | --- |
| `0x1826` Fitness Machine | `0x2ACC` Feature | read | `dc 56 00 00 0f 00 00 00`: distance, inclination, elevation, steps, resistance, energy, heart rate, elapsed time, power |
| | **`0x2ACD` Treadmill Data** | **notify** | **main data source** |
| | `0x2AD3` Training Status | read, notify | session phases |
| | `0x2ADA` Machine Status | notify | started, paused |
| | `0x2AD9` Control Point | write, indicate | unused (Cap never controls the treadmill) |
| | `0x2AD4` Speed Range | read | `50 00 b0 04 0a 00`: 0.8 to 12.0 km/h, step 0.1 |
| | `0x2AD5` Inclination Range | read | `00 00 96 00 0a 00`: 0 to 15 %, step 1 % |
| `0xFFF0` FitShow | `0xFFF1` / `0xFFF2` | notify / write | proprietary status, 1 frame/s |
| `0xFFE0` FitShow | `0xFFE4` / `0xFFE1` | notify / write | nothing received |
| `0x180D` Heart Rate | `0x2A37`, `0xB001`, `0xB002` | notify | heart rate always 0 |

Full dump: [`recordings/services-20261111-140957.txt`](recordings/services-20261111-140957.txt).

### Treadmill Data (`0x2ACD`)

Little-endian. Two frames are sent every second.

**Main frame, flags `0x058C` (19 bytes)**, example `8c 05 90 01 64 00 00 32 00 00 00 09 00 ff ff ff 00 9e 00`:

| Bytes | Field | Type | Unit | Example |
| --- | --- | --- | --- | --- |
| 0-1 | Flags | uint16 | | `0x058C` |
| 2-3 | Instantaneous speed | uint16 | 0.01 km/h | `90 01` = 4.00 km/h |
| 4-6 | Total distance | uint24 | m, 100 m steps | `64 00 00` = 100 m |
| 7-8 | Inclination | sint16 | 0.1 % | `32 00` = 5.0 % |
| 9-10 | Ramp angle | sint16 | 0.1 deg | always 0 |
| 11-12 | Total energy | uint16 | kcal | `09 00` = 9 kcal |
| 13-14 | Energy per hour | uint16 | kcal/h | `ff ff` = not available |
| 15 | Energy per minute | uint8 | kcal/min | `ff` = not available |
| 16 | Heart rate | uint8 | bpm | always 0 |
| 17-18 | Elapsed time | uint16 | s | `9e 00` = 158 s |

**Secondary frame, flags `0x2001`**: always `01 20 00 00 00`. Bit 0 set (no speed) plus bit 13, which is not defined by FTMS 1.0. **Ignore it**: decoders must skip frames whose bit 0 is set and tolerate unknown flag bits.

### Distance precision

Reference session: about 70 s from 0.8 to 2 km/h, then about 145 s at 4 km/h (the last part at 5 % incline).

| Elapsed (treadmill) | FTMS distance | Integrated speed | Console |
| --- | --- | --- | --- |
| 91 s | becomes 100 m | 58.8 m | |
| 181 s | becomes 200 m | 158.6 m | 0.1 then 0.2 km |
| 216 s (end) | 200 m | 201.9 m | 0.2 km |

The counter seems to round to the nearest 100 m, a few metres late. Integrating the 1 Hz speed matches the treadmill within 1 %.

**Rule used by Cap:** credited distance = speed integrated at each frame, re-anchored on the treadmill counter whenever it changes (maximum gap: 50 m). At the end of a session, keep the integral if it falls within the step reported by the treadmill, otherwise use the counter.

### Session phases

| Event | Training Status `0x2AD3` | Machine Status `0x2ADA` | FitShow `0xFFF1` |
| --- | --- | --- | --- |
| On, idle | `01 01` (idle) | | `02 51 00 51 03` |
| Start pressed (3, 2, 1 countdown) | `01 0e` (pre-workout) | `04` (started by user) | `02 51 02 03 50 03`, then `02`, `01` |
| Belt running | `01 0d` (manual mode) | | `02 51 03 ...` |
| Stop pressed | `01 0f` (post-workout), then `01 0d` | `02 02` (paused by user) | `02 51 0a ...` (summary) |

Counters (distance, time) stay frozen while paused. Whether they reset at the next session has not been verified yet.

### FitShow protocol (`0xFFF1`), fallback only

Frames look like `02 51 <state> <payload> <checksum> 03`, where the checksum is the XOR of the bytes between `02` and itself.

- State `00` idle, `02` countdown (payload = seconds left), `0a` finished (summary).
- State `03` running: speed (uint8, 0.1 km/h), incline (uint8, %), time (uint16, s), distance (uint16, m, 100 m steps), calories (uint16, 0.1 kcal), steps (uint16, always 0), 2 zero bytes. Example: `02 51 03 28 05 9e 00 64 00 5a 00 00 00 00 00 df 03` = 4.0 km/h, 5 %, 158 s, 100 m, 9.0 kcal.
- Frames arrive as soon as `0xFFF1` notifications are enabled. Nothing was written to `0xFFF2`.
