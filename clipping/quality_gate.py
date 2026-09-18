"""Low-cost post-AI quality gate for clip candidates.

Gemini provides semantic/viral judgement.  This module adds deterministic video
signals before rendering, so weak visual cuts do not consume GPU time.
"""
from __future__ import annotations


def _scene_cuts(video_path: str) -> list[float]:
    try:
        from scenedetect import ContentDetector, detect
        scenes = detect(video_path, ContentDetector(threshold=27.0), show_progress=False)
        return [scene[0].get_seconds() for scene in scenes[1:]]
    except Exception as exc:
        print(f"Quality gate: scene analysis unavailable ({exc}); using AI score only.")
        return []


def _boundary_score(start: float, end: float, segments: list[dict]) -> float:
    """Reward starts/ends that align with transcript word-group boundaries."""
    if not segments:
        return 70.0
    distances = []
    for point in (start, end):
        distances.append(min(min(abs(point - float(s.get("start", point))), abs(point - float(s.get("end", point)))) for s in segments))
    return 100.0 if max(distances) <= 0.6 else 75.0 if max(distances) <= 1.4 else 45.0


def score_candidates(clips: list[dict], video_path: str, segments: list[dict], minimum: float = 65.0) -> list[dict]:
    """Attach transparent quality scores and keep only sound candidates.

    The gate preserves the best candidate when all candidates fall below the
    threshold, avoiding an empty output from a difficult source.
    """
    cuts = _scene_cuts(video_path)
    for clip in clips:
        start, end = float(clip.get("start_time", 0)), float(clip.get("end_time", 0))
        duration = max(end - start, 0.1)
        interior_cuts = sum(start + 0.25 < cut < end - 0.25 for cut in cuts)
        scene_score = max(35.0, 100.0 - interior_cuts * 22.0)
        boundary_score = _boundary_score(start, end, segments)
        ai_score = max(0.0, min(100.0, float(clip.get("viral_score", 0))))
        quality = round(ai_score * 0.70 + scene_score * 0.20 + boundary_score * 0.10, 1)
        clip["quality_gate"] = {
            "score": quality,
            "ai_viral_score": ai_score,
            "scene_stability": round(scene_score, 1),
            "caption_boundary": round(boundary_score, 1),
            "scene_cuts_inside": interior_cuts,
            "reason": "Strong semantic hook with stable scene boundaries" if quality >= minimum else "Below quality threshold",
        }
        clip["quality_score"] = quality
    ranked = sorted(clips, key=lambda item: item["quality_score"], reverse=True)
    accepted = [clip for clip in ranked if clip["quality_score"] >= minimum]
    result = accepted or ranked[:1]
    for rank, clip in enumerate(result, 1):
        clip["rank"] = rank
    return result
