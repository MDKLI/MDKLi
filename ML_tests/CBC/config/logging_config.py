import logging

from centralized_logging.logger import get_logger
from config.settings import get_settings

logger = get_logger(__name__)


def configure_root_log_level() -> None:
    """Applies the configured LOG_LEVEL (from Settings/.env) to the root
    logger, so centralized_logging's existing handlers respect it without
    needing their own separate configuration path."""
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.getLogger().setLevel(level)
    logger.info(f"Log level set to: {settings.log_level.upper()}")