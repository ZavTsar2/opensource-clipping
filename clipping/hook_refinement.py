"""Deterministic start-time refinement for AI-selected clips."""
from __future__ import annotations

import math
import subprocess
from array import array


def _audio_peak(video_path: str, center: float, window: float) -> float | None:
    start, duration = max(0.0, center - window), max(0.1, window * 2)
    command = ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(duration), "-i", video_path,
               "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]
    try:
        raw = subprocess.run(command, capture_output=True, check=True, timeout=30).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    samples = array("h"); samples.frombytes(raw)
    bucket = 800
    if len(samples) < bucket:
        return None
    levels = [math.sqrt(sum(v * v for v in samples[i:i + bucket]) / bucket)
              for i in range(0, len(samples) - bucket + 1, bucket)]
    baseline = sum(levels) / len(levels)
    index, peak = max(enumerate(levels), key=lambda item: item[1])
    return start + index * 0.1 if baseline > 0 and peak >= baseline * 1.6 else None


def _motion_peak(video_path: str, center: float, window: float) -> float | None:
    try:
        import cv2
    except ImportError:
        return None
    capture = cv2.VideoCapture(video_path); fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    capture.set(cv2.CAP_PROP_POS_MSEC, max(0.0, center - window) * 1000)
    previous, score, timestamp = None, 0.0, None
    while capture.get(cv2.CAP_PROP_POS_MSEC) / 1000 <= center + window:
        ok, frame = capture.read()
        if not ok: break
        gray = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 90))
        if previous is not None:
            change = float(cv2.absdiff(gray, previous).mean())
            if change > score: score, timestamp = change, capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
        previous = gray
        capture.set(cv2.CAP_PROP_POS_FRAMES, capture.get(cv2.CAP_PROP_POS_FRAMES) + max(1, int(fps / 5)))
    capture.release()
    return timestamp if score >= 8.0 else None


def refine_clip_starts(clips: list[dict], video_path: str, hook_window: float = 3.0) -> list[dict]:
    """Correct starts using local audio peaks, then visual motion; log both."""
    for clip in clips:
        try: original = float(clip["start_time"])
        except (KeyError, TypeError, ValueError): continue
        peak, method = _audio_peak(video_path, original, hook_window), "audio_rms"
        if peak is None: peak, method = _motion_peak(video_path, original, hook_window), "frame_difference"
        corrected = max(0.0, peak - 0.75) if peak is not None else original
        clip.update(original_start_time=original, corrected_start_time=round(corrected, 3),
                    hook_refinement_method=method if peak is not None else "unchanged", start_time=round(corrected, 3))
    return clips
