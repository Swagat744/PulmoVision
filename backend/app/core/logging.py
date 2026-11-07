"""Structured logging configuration for PulmoVision AI."""
import logging
import sys


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Configure application-wide structured console logging."""
    logger = logging.getLogger("pulmovision")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger


logger = setup_logging()

