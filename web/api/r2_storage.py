"""Optional private Cloudflare R2 delivery for finished Clip Studio media."""

from __future__ import annotations

import os
from pathlib import Path


_REQUIRED = ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET")


def is_configured() -> bool:
    return all(os.environ.get(name) for name in _REQUIRED)


def _client():
    if not is_configured():
        raise RuntimeError("R2 is not configured")

    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def _expires_in() -> int:
    try:
        value = int(os.environ.get("R2_PRESIGN_TTL_SECONDS", "3600"))
    except ValueError:
        value = 3600
    return max(60, min(value, 604800))


def upload_and_presign(
    local_path: str,
    *,
    object_key: str,
    content_type: str,
    download_name: str | None = None,
) -> str:
    """Upload one private object and return a short-lived GET URL."""
    path = Path(local_path)
    if not path.is_file():
        raise FileNotFoundError(path)

    client = _client()
    bucket = os.environ["R2_BUCKET"]
    client.upload_file(
        str(path),
        bucket,
        object_key,
        ExtraArgs={"ContentType": content_type, "CacheControl": "private, max-age=3600"},
    )
    params = {"Bucket": bucket, "Key": object_key}
    if download_name:
        params["ResponseContentDisposition"] = f'attachment; filename="{download_name}"'
    return client.generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=_expires_in(),
    )


def publish_clip(job_id: str, *, video_path: str, thumbnail_path: str | None = None) -> tuple[str, str, str | None]:
    """Publish one completed clip and its thumbnail under an isolated job prefix."""
    video_name = Path(video_path).name
    video_key = f"clips/{job_id}/{video_name}"
    preview_url = upload_and_presign(
        video_path,
        object_key=video_key,
        content_type="video/mp4",
    )
    download_url = upload_and_presign(
        video_path,
        object_key=video_key,
        content_type="video/mp4",
        download_name=video_name,
    )
    thumbnail_url = None
    if thumbnail_path and Path(thumbnail_path).is_file():
        thumbnail_url = upload_and_presign(
            thumbnail_path,
            object_key=f"thumbnails/{job_id}/{Path(thumbnail_path).name}",
            content_type="image/jpeg",
        )
    return preview_url, download_url, thumbnail_url
