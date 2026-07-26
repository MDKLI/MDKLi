import mimetypes
from dataclasses import dataclass

SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
SUPPORTED_DOCUMENT_TYPES = {"application/pdf"}


@dataclass
class PreparedImage:
    content_type: str  # "image" or "document"
    media_type: str    # e.g. "image/jpeg", "application/pdf"
    raw_bytes: bytes    # raw file bytes; each vision_client encodes as needed


def prepare_file_for_vision(file_bytes: bytes, filename: str) -> PreparedImage:
    """Classifies an uploaded image or PDF for the vision provider.

    Kept provider-agnostic: stores raw bytes rather than a pre-encoded
    base64 string, since different SDKs (Anthropic vs Gemini) expect
    different encodings at the call site.
    """
    media_type, _ = mimetypes.guess_type(filename)

    if media_type in SUPPORTED_IMAGE_TYPES:
        content_type = "image"
    elif media_type in SUPPORTED_DOCUMENT_TYPES:
        content_type = "document"
    else:
        raise ValueError(
            f"Unsupported file type for '{filename}' (detected: {media_type}). "
            f"Supported: {sorted(SUPPORTED_IMAGE_TYPES | SUPPORTED_DOCUMENT_TYPES)}"
        )

    return PreparedImage(content_type=content_type, media_type=media_type, raw_bytes=file_bytes)
