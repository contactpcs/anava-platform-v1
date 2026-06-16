#!/usr/bin/env python3
"""Convert EDF/EDF+ files to NeuroElectrics NEDF 1.4 format.

Usage:
    python edf_to_nedf.py input.edf
    python edf_to_nedf.py input.edf -o output.nedf
    python edf_to_nedf.py input.edf -n "John Doe" --sfreq 500
"""

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path

import mne
import numpy as np


# Fixed NEDF header size (XML content + null-byte padding)
_HDRLEN = 10240

# Volts per ADC count — from NeuroElectrics NEDF EEGLAB plugin spec
# MNE uses this same constant when reading NEDF files
_CAL = 2.4 / (6.0 * 8388607)


def _volts_to_adc(data_v: np.ndarray) -> np.ndarray:
    """Convert volt values to 24-bit signed ADC integers."""
    adc = np.round(data_v / _CAL).astype(np.int32)
    return np.clip(adc, -(1 << 23), (1 << 23) - 1)


def _encode_uint24_be(adc: np.ndarray) -> np.ndarray:
    """Encode int32 array to uint8 triplets (big-endian 24-bit unsigned).

    NEDF stores EEG as 3 uint8 bytes per sample. MNE decodes with:
        value = b[0]<<16 | b[1]<<8 | b[2]
        if value > 2^23: value -= 2^24   (sign extension)
    """
    unsigned = np.where(adc < 0, adc + (1 << 24), adc).astype(np.uint32)
    b0 = ((unsigned >> 16) & 0xFF).astype(np.uint8)
    b1 = ((unsigned >> 8) & 0xFF).astype(np.uint8)
    b2 = (unsigned & 0xFF).astype(np.uint8)
    return np.stack([b0, b1, b2], axis=-1)  # (..., 3)


def _build_xml_header(
    patient_name: str,
    timestamp_ms: int,
    n_channels: int,
    channel_names: list,
    sfreq: int,
    n_samples: int,
    duration_s: float,
) -> str:
    """Build the NEDF 1.4 XML header string."""
    root_tag = re.sub(r"\s+", "_", patient_name.strip()) + f"_{timestamp_ms}"
    montage = "\n".join(
        f"   <Channel{i + 1}>{name}</Channel{i + 1}>"
        for i, name in enumerate(channel_names)
    )
    return (
        f"<{root_tag}>\n"
        f" <NEDFversion>1.4</NEDFversion>\n"
        f" <StepDetails>\n"
        f"  <StepName></StepName>\n"
        f"  <StartDate_firstEEGTimestamp>{timestamp_ms}</StartDate_firstEEGTimestamp>\n"
        f"  <DeviceClass>ENOBIO</DeviceClass>\n"
        f"  <DeviceID>EDF2NEDF_CONVERTER</DeviceID>\n"
        f"  <SoftwareVersion>edf_to_nedf.py 1.0</SoftwareVersion>\n"
        f"  <FirmwareVersion>0</FirmwareVersion>\n"
        f"  <CommunicationType>N/A</CommunicationType>\n"
        f"  <OperativeSystem></OperativeSystem>\n"
        f"  <SDCardFilename>NONE</SDCardFilename>\n"
        f"  <NOISEFilter>NONE</NOISEFilter>\n"
        f"  <AdditionalChannel>NONE</AdditionalChannel>\n"
        f"  <EOGCorrectionStatus>NONE</EOGCorrectionStatus>\n"
        f" </StepDetails>\n"
        f" <EEGSettings>\n"
        f"  <TotalNumberOfChannels>{n_channels}</TotalNumberOfChannels>\n"
        f"  <NumberOfEEGChannels>{n_channels}</NumberOfEEGChannels>\n"
        f"  <NumberOfRecordsOfEEG>{n_samples}</NumberOfRecordsOfEEG>\n"
        f"  <EEGSamplingRate>{sfreq}</EEGSamplingRate>\n"
        f"  <EEGRecordingDuration>{int(duration_s)}</EEGRecordingDuration>\n"
        f"  <NumberOfPacketsLost>0</NumberOfPacketsLost>\n"
        f"  <LineFilterStatus>NONE</LineFilterStatus>\n"
        f"  <FIRFilterStatus>OFF</FIRFilterStatus>\n"
        f"  <EOGFilterStatus>OFF</EOGFilterStatus>\n"
        f"  <ReferenceFilterStatus>OFF</ReferenceFilterStatus>\n"
        f"  <EEGUnits>nV</EEGUnits>\n"
        f"  <EEGMontage>\n"
        f"{montage}\n"
        f"  </EEGMontage>\n"
        f" </EEGSettings>\n"
        # Accelerometer must be present: MNE's reader indexes dtype[1] for the
        # data field, which only works when acc occupies dtype[0].
        f" <AccelerometerData>ON</AccelerometerData>\n"
        f" <NumberOfChannelsOfAccelerometer>3</NumberOfChannelsOfAccelerometer>\n"
        f" <AccelerometerSamplingRate>100</AccelerometerSamplingRate>\n"
        f" <AccelerometerUnits>mm/s^2</AccelerometerUnits>\n"
        f" <TriggerInformation></TriggerInformation>\n"
        f" <UserNotes></UserNotes>\n"
        f"</{root_tag}>\n"
    )


def convert_edf_to_nedf(
    edf_path,
    output_path=None,
    patient_name=None,
    sfreq=None,
):
    """Convert an EDF file to NEDF 1.4 format.

    Parameters
    ----------
    edf_path : str or Path
        Input .edf file.
    output_path : str or Path, optional
        Output .nedf path. Defaults to <timestamp>_<patient>.nedf in same dir.
    patient_name : str, optional
        Patient name for header. Falls back to EDF subject info or filename.
    sfreq : int, optional
        Resample to this frequency in Hz before writing.

    Returns
    -------
    Path
        Path to the written .nedf file.
    """
    edf_path = Path(edf_path)
    print(f"Reading: {edf_path}")
    raw = mne.io.read_raw_edf(str(edf_path), preload=True, verbose=False)

    if sfreq and int(raw.info["sfreq"]) != sfreq:
        print(f"Resampling {raw.info['sfreq']} → {sfreq} Hz")
        raw.resample(sfreq, verbose=False)

    native_sfreq = int(raw.info["sfreq"])

    # Resolve patient name
    if patient_name is None:
        subj = raw.info.get("subject_info") or {}
        first = (subj.get("first_name") or "").strip()
        last = (subj.get("last_name") or "").strip()
        patient_name = f"{first} {last}".strip() or edf_path.stem

    # Timestamp in milliseconds since epoch
    if raw.info["meas_date"] is not None:
        ts_ms = int(raw.info["meas_date"].timestamp() * 1000)
    else:
        ts_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    # Build output path
    if output_path is None:
        safe = re.sub(r"\s+", "_", patient_name.strip())
        output_path = edf_path.parent / f"{ts_ms}_{safe}.nedf"
    output_path = Path(output_path)

    # Select EEG channels; fall back to all channels if none typed as EEG
    eeg_picks = mne.pick_types(raw.info, eeg=True, exclude=[])
    if len(eeg_picks) == 0:
        eeg_picks = np.arange(len(raw.ch_names))
    ch_names = [raw.ch_names[i] for i in eeg_picks]
    n_channels = len(ch_names)

    print(f"Channels: {n_channels}, sfreq: {native_sfreq} Hz")

    # EEG data: MNE returns volts
    data_v, _ = raw[eeg_picks, :]

    # Trigger channel (int32 per sample)
    stim_picks = mne.pick_types(raw.info, stim=True, exclude=[])
    if len(stim_picks) > 0:
        stim_v, _ = raw[stim_picks[0], :]
        trig = stim_v[0].astype(np.int32)
    else:
        trig = np.zeros(data_v.shape[1], dtype=np.int32)
        events, _ = mne.events_from_annotations(raw, verbose=False)
        for ev in events:
            if ev[0] < len(trig):
                trig[ev[0]] = ev[2]

    n_samples_raw = data_v.shape[1]
    duration_s = n_samples_raw / native_sfreq

    # Pad to a multiple of 5 (NEDF blocks hold 5 samples each)
    pad = (5 - n_samples_raw % 5) % 5
    if pad:
        data_v = np.pad(data_v, ((0, 0), (0, pad)))
        trig = np.pad(trig, (0, pad))

    n_blocks = (n_samples_raw + pad) // 5

    # Build XML header (null-padded to exactly _HDRLEN bytes)
    xml = _build_xml_header(
        patient_name=patient_name,
        timestamp_ms=ts_ms,
        n_channels=n_channels,
        channel_names=ch_names,
        sfreq=native_sfreq,
        n_samples=n_samples_raw,
        duration_s=duration_s,
    )
    xml_bytes = xml.encode("utf-8")
    if len(xml_bytes) >= _HDRLEN:
        raise ValueError(
            f"XML header ({len(xml_bytes)} bytes) exceeds {_HDRLEN} byte limit. "
            "Shorten patient name or channel names."
        )
    header = xml_bytes + b"\0" * (_HDRLEN - len(xml_bytes))

    # Encode EEG: volts → ADC counts → uint8 triplets
    adc = _volts_to_adc(data_v)          # (n_channels, n_padded_samples)
    encoded = _encode_uint24_be(adc)     # (n_channels, n_padded_samples, 3)

    # Build structured array matching MNE's expected dtype:
    # dtype = [("acc", ">u2", (3,)), ("data", datadt, (5,))]
    # where datadt = [("eeg", "B", (n_channels, 3)), ("trig", ">i4")]
    datadt = np.dtype([("eeg", "B", (n_channels, 3)), ("trig", ">i4")])
    dt = np.dtype([("acc", ">u2", (3,)), ("data", datadt, (5,))])
    blocks = np.zeros(n_blocks, dtype=dt)

    # Fill EEG: reshape (n_channels, n_samples, 3) → (n_blocks, 5, n_channels, 3)
    enc_t = encoded.transpose(1, 0, 2)           # (n_samples, n_channels, 3)
    enc_r = enc_t.reshape(n_blocks, 5, n_channels, 3)
    blocks["data"]["eeg"] = enc_r

    # Fill trigger: (n_samples,) → (n_blocks, 5)
    blocks["data"]["trig"] = trig.reshape(n_blocks, 5)

    # acc left as zeros (EDF has no accelerometer)

    print(f"Writing: {output_path}")
    with open(output_path, "wb") as f:
        f.write(header)
        f.write(blocks.tobytes())

    # Verify the output can be read back by MNE
    print("Verifying...")
    try:
        check = mne.io.read_raw_nedf(str(output_path), preload=False, verbose=False)
        print(
            f"OK — {check.info['nchan'] - 1} EEG ch, "
            f"{check.n_times} samples, "
            f"{check.info['sfreq']} Hz"
        )
    except Exception as exc:
        print(f"Warning: read-back verification failed: {exc}")

    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Convert EDF/EDF+ to NeuroElectrics NEDF 1.4"
    )
    parser.add_argument("edf", help="Input .edf file")
    parser.add_argument("-o", "--output", help="Output .nedf file path")
    parser.add_argument("-n", "--name", help="Patient name for NEDF header")
    parser.add_argument(
        "--sfreq", type=int,
        help="Resample to this sampling frequency (Hz) before writing"
    )
    args = parser.parse_args()

    out = convert_edf_to_nedf(
        args.edf,
        output_path=args.output,
        patient_name=args.name,
        sfreq=args.sfreq,
    )
    print(f"Done: {out}")


if __name__ == "__main__":
    main()
