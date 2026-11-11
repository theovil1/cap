"""Bluetooth probe to reverse-engineer a treadmill (Cap, step 0).

Usage:
    .venv\\Scripts\\python probe.py                     scan, then pick the treadmill
    .venv\\Scripts\\python probe.py --address XX        connect directly
    .venv\\Scripts\\python probe.py --address XX --inventory-only

The script:
  1. scans BLE devices and lets you pick the treadmill;
  2. lists every service and characteristic (saved to a .txt file);
  3. subscribes to every notification and indication;
  4. guides you step by step (stopped, 2 km/h, 4 km/h, incline, stopped);
  5. writes every frame to a CSV (timestamp, step, characteristic, bytes).

While recording, a single status line refreshes in place: frames are not
printed one by one, they all go to the CSV.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path

from bleak import BleakClient, BleakScanner
from bleak.backends.characteristic import BleakGATTCharacteristic

import ftms

try:
    import msvcrt  # Windows: non-blocking key reads
except ImportError:  # pragma: no cover
    msvcrt = None

OUTPUT_DIR = Path(__file__).resolve().parent / "recordings"

# (code, title, instructions, recording duration in s)
STEPS = [
    ("stopped", "Treadmill stopped",
     ["Keep the treadmill on, belt not moving."], 20),
    ("2kmh", "2 km/h",
     ["Start the treadmill and set it to 2 km/h.",
      "Step on and walk normally."], 40),
    ("4kmh", "4 km/h",
     ["Switch to 4 km/h and keep walking."], 60),
    ("incline", "Incline change",
     ["Keep 4 km/h and change the incline.",
      "If your treadmill has no incline, press S to skip."], 40),
    ("stopped_end", "Final stop",
     ["Stop the treadmill and wait until the belt is still."], 20),
]

WIDTH = 64


def now() -> str:
    return datetime.now().isoformat(timespec="milliseconds")


class Log:
    """Writes the frame CSV row by row, flushing immediately."""

    COLUMNS = ["timestamp", "t_s", "step", "kind", "characteristic",
               "name", "bytes_hex", "decoded"]

    def __init__(self, path: Path):
        self.file = path.open("w", newline="", encoding="utf-8")
        self.csv = csv.writer(self.file)
        self.csv.writerow(self.COLUMNS)
        self.t0 = time.monotonic()
        self.step = "connect"

    def write(self, kind: str, uuid: str = "", name: str = "",
              data: bytes | None = None, decoded=None) -> None:
        self.csv.writerow([
            now(),
            f"{time.monotonic() - self.t0:.3f}",
            self.step,
            kind,
            uuid,
            name,
            data.hex(" ") if data is not None else "",
            json.dumps(decoded, ensure_ascii=False) if decoded is not None else "",
        ])
        self.file.flush()

    def close(self) -> None:
        self.file.close()


class State:
    """Latest values received, for the live status line."""

    def __init__(self):
        self.ftms: dict = {}
        self.frame_count = 0
        self.connected = True

    def line(self) -> str:
        if not self.connected:
            return "Treadmill disconnected!"
        d = self.ftms
        if not d:
            return f"Waiting for treadmill data... ({self.frame_count} frames)"
        parts = []
        if "speed_kmh" in d:
            parts.append(f"{d['speed_kmh']:.1f} km/h")
        if "distance_m" in d:
            parts.append(f"{d['distance_m']} m")
        if "incline_pct" in d:
            parts.append(f"incline {d['incline_pct']:.0f} %")
        if "elapsed_s" in d:
            s = d["elapsed_s"]
            parts.append(f"{s // 60}:{s % 60:02d}")
        return "Treadmill sends: " + "   ".join(parts)


def write_line(text: str) -> None:
    sys.stdout.write("\r" + text.ljust(WIDTH + 10)[:WIDTH + 10])
    sys.stdout.flush()


def heading(text: str) -> None:
    print("\n" + "=" * WIDTH)
    print(" " + text)
    print("=" * WIDTH)


async def ask(question: str) -> str:
    """input() in a thread so notifications keep flowing."""
    try:
        return (await asyncio.to_thread(input, question)).strip()
    except EOFError:
        return ""


async def wait_for_key(state: State) -> str:
    """Show the live status until Enter (ok), S (skip) or Q (quit)."""
    if msvcrt is None:
        answer = (await ask("Enter to continue, s to skip, q to quit: ")).lower()
        return {"s": "skip", "q": "quit"}.get(answer, "ok")
    while msvcrt.kbhit():  # drop keys typed ahead
        msvcrt.getwch()
    while True:
        write_line("  " + state.line())
        await asyncio.sleep(0.3)
        while msvcrt.kbhit():
            key = msvcrt.getwch().lower()
            if key in ("\r", "\n"):
                print()
                return "ok"
            if key == "s":
                print()
                return "skip"
            if key == "q":
                print()
                return "quit"


async def record(state: State, seconds: int) -> None:
    end = time.monotonic() + seconds
    while (left := end - time.monotonic()) > 0:
        write_line(f"  Recording, do not touch anything: {left:4.0f} s   | {state.line()}")
        await asyncio.sleep(0.3)
    write_line("  Recording done.")
    print()


async def scan(duration: float):
    print(f"Scanning for Bluetooth devices for {duration:.0f} s...")
    found = await BleakScanner.discover(timeout=duration, return_adv=True)
    devices = sorted(found.values(), key=lambda da: da[1].rssi, reverse=True)
    if not devices:
        print("No device found. Is the treadmill on and free from any other app?")
        return None
    print()
    for i, (dev, adv) in enumerate(devices, 1):
        name = adv.local_name or dev.name or "(no name)"
        services = [s.lower() for s in adv.service_uuids]
        mark = "  <- FTMS" if ftms.FTMS_SERVICE in services else ""
        short = ", ".join(s[4:8] if s.endswith("-0000-1000-8000-00805f9b34fb") else s
                          for s in services)
        print(f"{i:3d}. {name:<28} {dev.address}  {adv.rssi:4d} dBm  [{short}]{mark}")
    print()
    while True:
        choice = await ask("Treadmill number (Enter to cancel): ")
        if not choice:
            return None
        if choice.isdigit() and 1 <= int(choice) <= len(devices):
            return devices[int(choice) - 1][0]
        print("Invalid number.")


def char_name(c: BleakGATTCharacteristic) -> str:
    return ftms.NAMES.get(c.uuid.lower()) or c.description or ""


async def inventory(client: BleakClient, log: Log, txt_path: Path, show: bool) -> list:
    """List services and characteristics, read what is readable, return notifiable ones."""
    lines = []
    notifiable = []
    for service in client.services:
        service_name = ftms.NAMES.get(service.uuid.lower()) or service.description
        lines.append(f"Service {service.uuid}  {service_name}")
        for c in service.characteristics:
            props = ",".join(c.properties)
            lines.append(f"    Char. {c.uuid}  handle {c.handle}  [{props}]  {char_name(c)}")
            for d in c.descriptors:
                lines.append(f"        Descr. {d.uuid}  handle {d.handle}  {d.description}")
            if "read" in c.properties:
                try:
                    value = bytes(await client.read_gatt_char(c))
                    decoded = ftms.decode(c.uuid, value)
                    text = value.decode("utf-8", "replace") if value and all(
                        32 <= b < 127 for b in value) else ""
                    lines.append(f"        value: {value.hex(' ')}"
                                 + (f"  \"{text}\"" if text else "")
                                 + (f"  {decoded}" if decoded else ""))
                    log.write("read", c.uuid, char_name(c), value, decoded)
                except Exception as e:  # noqa: BLE001
                    lines.append(f"        read failed: {e}")
            if "notify" in c.properties or "indicate" in c.properties:
                notifiable.append(c)
    text = "\n".join(lines)
    if show:
        print(text)
    txt_path.write_text(text + "\n", encoding="utf-8")
    return notifiable


async def read_console(log: Log) -> None:
    print("  Look at the treadmill console and type what it shows.")
    print("  Leave empty if it is not shown, then press Enter.")
    console = {
        "speed": await ask("    Speed    (e.g. 2.0)      : "),
        "distance": await ask("    Distance (e.g. 0.05 km)  : "),
        "incline": await ask("    Incline  (e.g. 0)        : "),
    }
    log.write("console", decoded=console)


async def guided_steps(log: Log, state: State) -> bool:
    """Return False if the user quit before the end."""
    heading("Guided recording: 5 steps, about 5 minutes")
    print(" For each step: follow the instructions, wait until the console")
    print(" is stable, then press Enter. The script records on its own,")
    print(" then asks what the console shows.")
    print(" Keys: Enter = stable, S = skip the step, Q = quit.")

    for n, (code, title, instructions, duration) in enumerate(STEPS, 1):
        heading(f"STEP {n} of {len(STEPS)}: {title}")
        for i, instruction in enumerate(instructions, 1):
            print(f"  {i}. {instruction}")
        print(f"  {len(instructions) + 1}. When it is stable, press Enter.")
        print()
        choice = await wait_for_key(state)
        if choice == "quit":
            log.write("quit", decoded={"step": code})
            return False
        if choice == "skip":
            log.write("step_skipped", decoded={"step": code})
            print("  Step skipped.")
            continue
        log.step = code
        log.write("step_start", decoded={"step": code})
        await record(state, duration)
        print()
        await read_console(log)
        log.write("step_end", decoded={"step": code})
        log.step = "transition"
    return True


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--address", help="treadmill Bluetooth address (skips the scan)")
    parser.add_argument("--scan", type=float, default=10, help="scan duration in s")
    parser.add_argument("--inventory-only", action="store_true",
                        help="list services and characteristics, then exit")
    args = parser.parse_args()

    if args.address:
        target = args.address
        label = args.address
    else:
        dev = await scan(args.scan)
        if dev is None:
            return 1
        target = dev
        label = dev.name or dev.address

    OUTPUT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    csv_path = OUTPUT_DIR / f"frames-{stamp}.csv"
    txt_path = OUTPUT_DIR / f"services-{stamp}.txt"
    log = Log(csv_path)
    state = State()

    def on_disconnect(_client):
        state.connected = False
        log.write("disconnect")

    print(f"\nConnecting to {label}...")
    try:
        async with BleakClient(target, disconnected_callback=on_disconnect, timeout=20) as client:
            log.write("connect", decoded={"device": str(label), "address": client.address})
            notifiable = await inventory(client, log, txt_path, show=args.inventory_only)
            if args.inventory_only:
                return 0

            def on_frame(c: BleakGATTCharacteristic, data: bytearray):
                raw = bytes(data)
                decoded = ftms.decode(c.uuid, raw)
                log.write("frame", c.uuid, char_name(c), raw, decoded)
                state.frame_count += 1
                if (c.uuid.lower() == ftms.TREADMILL_DATA and decoded
                        and "speed_kmh" in decoded):
                    state.ftms = decoded

            failures = 0
            for c in notifiable:
                try:
                    await client.start_notify(c, on_frame)
                except Exception as e:  # noqa: BLE001
                    failures += 1
                    log.write("subscribe_failed", c.uuid, char_name(c),
                              decoded={"error": str(e)})
            print(f"Connected. Listening to {len(notifiable) - failures} characteristic(s).")

            finished = await guided_steps(log, state)

            heading("Done, thank you!" if finished else "Stopped")
            print(f"  {state.frame_count} frames recorded.")
    except Exception as e:  # noqa: BLE001
        print(f"\nError: {e}")
        log.write("error", decoded={"error": str(e)})
        return 1
    finally:
        log.close()
        print(f"  File: {csv_path.name}")
    return 0


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nInterrupted.")
