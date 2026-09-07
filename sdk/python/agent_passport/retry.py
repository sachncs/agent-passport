"""Retry helpers for the Agent Passport Python SDK."""

from __future__ import annotations

import random
import time
from typing import Optional, Set

RETRYABLE_STATUSES: Set[int] = {408, 429, 500, 502, 503, 504}


def compute_backoff(attempt: int, base_delay: float) -> float:
    """Exponential backoff with 50% jitter, in seconds."""
    exponential = base_delay * (2 ** attempt)
    jitter = exponential * 0.5 * random.random()
    return exponential + jitter


def is_retryable_status(status: int, allowed: Set[int] = RETRYABLE_STATUSES) -> bool:
    return status in allowed


def sleep_with_signal(seconds: float) -> None:
    time.sleep(max(0.0, seconds))
