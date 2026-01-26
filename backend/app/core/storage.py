from __future__ import annotations

import os
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.settings import settings
from app.core.logging import setup_logging

logger = setup_logging()


class StorageError(Exception):
    """Base exception for storage-related failures."""


class ObjectNotFound(StorageError):
    """Raised when an object does not exist."""


class StorageClient:
    """
    S3-compatible storage client.
    Works with MinIO and AWS S3.
    """

    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            use_ssl=settings.S3_USE_SSL,
            config=Config(signature_version="s3v4"),
        )

        logger.info(
            "Initialized StorageClient",
            extra={
                "endpoint": settings.S3_ENDPOINT,
                "region": settings.S3_REGION,
                "use_ssl": settings.S3_USE_SSL,
            },
        )
        

    # ---------- Public API ----------

    def download_file(self, bucket: str, object_key: str, local_path: str) -> None:
        logger.debug(
            "Downloading object",
            extra={
                "bucket": bucket,
                "object_key": object_key,
                "local_path": local_path,
            },
        )

        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            self._client.download_file(bucket, object_key, local_path)

            logger.debug(
                "Download successful",
                extra={"bucket": bucket, "object_key": object_key},
            )

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")

            logger.error(
                "Download failed",
                extra={
                    "bucket": bucket,
                    "object_key": object_key,
                    "error_code": error_code,
                },
                exc_info=True,
            )

            if error_code == "NoSuchKey":
                raise ObjectNotFound(
                    f"Object '{object_key}' not found in bucket '{bucket}'"
                ) from e

            raise StorageError(
                f"Failed to download object '{object_key}' from bucket '{bucket}'"
            ) from e

        except BotoCoreError as e:
            logger.error(
                "Storage backend error during download",
                extra={"bucket": bucket, "object_key": object_key},
                exc_info=True,
            )
            raise StorageError("Storage backend error") from e

    def upload_file(self, local_path: str, bucket: str, object_key: str, content_type: Optional[str] = None) -> None:
        logger.debug(
            "Uploading object",
            extra={
                "bucket": bucket,
                "object_key": object_key,
                "local_path": local_path,
                "content_type": content_type,
            },
        )

        extra_args = {"ContentType": content_type} if content_type else None

        try:
            self._client.upload_file(local_path, bucket, object_key, ExtraArgs=extra_args)

            logger.debug(
                "Upload successful",
                extra={"bucket": bucket, "object_key": object_key},
            )

        except BotoCoreError as e:
            logger.error(
                "Upload failed",
                extra={
                    "bucket": bucket,
                    "object_key": object_key,
                    "local_path": local_path,
                },
                exc_info=True,
            )
            raise StorageError(
                f"Failed to upload object '{object_key}' to bucket '{bucket}'"
            ) from e

    def object_exists(self, bucket: str, object_key: str) -> bool:
        logger.debug(
            "Checking object existence",
            extra={"bucket": bucket, "object_key": object_key},
        )

        try:
            self._client.head_object(Bucket=bucket, Key=object_key)
            return True

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")

            if error_code == "404":
                return False

            logger.error(
                "Failed to check object existence",
                extra={
                    "bucket": bucket,
                    "object_key": object_key,
                    "error_code": error_code,
                },
                exc_info=True,
            )

            raise StorageError(
                f"Failed to check existence of object '{object_key}' in bucket '{bucket}'"
            ) from e
