"""Decoders for the Bluetooth SIG Fitness Machine Service (FTMS).

References: FTMS v1.0 and the GATT Specification Supplement
(Treadmill Data 0x2ACD, Fitness Machine Feature 0x2ACC,
Supported Speed Range 0x2AD4, Supported Inclination Range 0x2AD5).
"""

from __future__ import annotations

import struct

FTMS_SERVICE = "00001826-0000-1000-8000-00805f9b34fb"
TREADMILL_DATA = "00002acd-0000-1000-8000-00805f9b34fb"
FEATURE = "00002acc-0000-1000-8000-00805f9b34fb"
SPEED_RANGE = "00002ad4-0000-1000-8000-00805f9b34fb"
INCLINATION_RANGE = "00002ad5-0000-1000-8000-00805f9b34fb"
TRAINING_STATUS = "00002ad3-0000-1000-8000-00805f9b34fb"
MACHINE_STATUS = "00002ada-0000-1000-8000-00805f9b34fb"
CONTROL_POINT = "00002ad9-0000-1000-8000-00805f9b34fb"

NAMES = {
    FTMS_SERVICE: "Fitness Machine (FTMS)",
    TREADMILL_DATA: "Treadmill Data",
    FEATURE: "Fitness Machine Feature",
    SPEED_RANGE: "Supported Speed Range",
    INCLINATION_RANGE: "Supported Inclination Range",
    TRAINING_STATUS: "Training Status",
    MACHINE_STATUS: "Fitness Machine Status",
    CONTROL_POINT: "Fitness Machine Control Point",
}

FEATURE_BITS = [
    "average speed", "cadence", "total distance", "inclination",
    "elevation gain", "pace", "step count", "resistance level", "stride count",
    "expended energy", "heart rate", "metabolic equivalent",
    "elapsed time", "remaining time", "power", "force on belt",
    "user data retention",
]


class Reader:
    def __init__(self, data: bytes):
        self.data = bytes(data)
        self.pos = 0

    def read(self, fmt: str):
        size = struct.calcsize(fmt)
        if self.pos + size > len(self.data):
            raise ValueError("frame too short")
        (value,) = struct.unpack_from(fmt, self.data, self.pos)
        self.pos += size
        return value

    def uint24(self) -> int:
        if self.pos + 3 > len(self.data):
            raise ValueError("frame too short")
        b = self.data[self.pos:self.pos + 3]
        self.pos += 3
        return b[0] | (b[1] << 8) | (b[2] << 16)


def decode_treadmill_data(data: bytes) -> dict:
    """Decode a Treadmill Data frame (0x2ACD). Units: km/h, m, %, s."""
    r = Reader(data)
    flags = r.read("<H")
    out: dict = {"flags": f"0x{flags:04x}"}
    if not flags & 0x0001:  # bit 0 "More Data" cleared: speed is present
        out["speed_kmh"] = r.read("<H") / 100
    if flags & 0x0002:
        out["avg_speed_kmh"] = r.read("<H") / 100
    if flags & 0x0004:
        out["distance_m"] = r.uint24()
    if flags & 0x0008:
        out["incline_pct"] = r.read("<h") / 10
        out["ramp_angle_deg"] = r.read("<h") / 10
    if flags & 0x0010:
        out["elevation_gain_pos_m"] = r.read("<H") / 10
        out["elevation_gain_neg_m"] = r.read("<H") / 10
    if flags & 0x0020:
        out["pace_km_min"] = r.read("<B") / 10
    if flags & 0x0040:
        out["avg_pace_km_min"] = r.read("<B") / 10
    if flags & 0x0080:
        out["energy_kcal"] = r.read("<H")
        out["energy_kcal_h"] = r.read("<H")
        out["energy_kcal_min"] = r.read("<B")
    if flags & 0x0100:
        out["heart_rate_bpm"] = r.read("<B")
    if flags & 0x0200:
        out["met"] = r.read("<B") / 10
    if flags & 0x0400:
        out["elapsed_s"] = r.read("<H")
    if flags & 0x0800:
        out["remaining_s"] = r.read("<H")
    if flags & 0x1000:
        out["belt_force_n"] = r.read("<h")
        out["power_w"] = r.read("<h")
    if r.pos != len(r.data):
        out["extra_bytes"] = r.data[r.pos:].hex(" ")
    return out


def decode_feature(data: bytes) -> dict:
    machine, targets = struct.unpack_from("<II", data)
    return {
        "features": [name for i, name in enumerate(FEATURE_BITS) if machine >> i & 1],
        "machine_hex": f"0x{machine:08x}",
        "targets_hex": f"0x{targets:08x}",
    }


def decode_speed_range(data: bytes) -> dict:
    low, high, step = struct.unpack_from("<HHH", data)
    return {"min_kmh": low / 100, "max_kmh": high / 100, "step_kmh": step / 100}


def decode_inclination_range(data: bytes) -> dict:
    low, high, step = struct.unpack_from("<hhH", data)
    return {"min_pct": low / 10, "max_pct": high / 10, "step_pct": step / 10}


DECODERS = {
    TREADMILL_DATA: decode_treadmill_data,
    FEATURE: decode_feature,
    SPEED_RANGE: decode_speed_range,
    INCLINATION_RANGE: decode_inclination_range,
}


def decode(uuid: str, data: bytes) -> dict | None:
    fn = DECODERS.get(uuid.lower())
    if fn is None:
        return None
    try:
        return fn(data)
    except (ValueError, struct.error) as e:
        return {"error": str(e)}
