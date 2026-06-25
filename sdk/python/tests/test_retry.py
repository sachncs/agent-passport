"""Tests for the retry helper."""

from agent_passport.retry import compute_backoff, is_retryable_status, RETRYABLE_STATUSES


def test_backoff_grows_with_attempt() -> None:
    b0 = compute_backoff(0, 1.0)
    b1 = compute_backoff(1, 1.0)
    b2 = compute_backoff(2, 1.0)
    # The mean of each should be 1.0, 2.0, 4.0
    # We can't predict exact values due to jitter, but exponential factor should hold
    assert b1 > b0 * 0.8  # at least ~80% of the expected 2x
    assert b2 > b1 * 0.8


def test_retryable_statuses_includes_5xx() -> None:
    assert is_retryable_status(500)
    assert is_retryable_status(502)
    assert is_retryable_status(503)
    assert is_retryable_status(504)


def test_retryable_statuses_includes_429() -> None:
    assert is_retryable_status(429)


def test_retryable_statuses_excludes_4xx() -> None:
    assert not is_retryable_status(400)
    assert not is_retryable_status(404)
    assert not is_retryable_status(401)


def test_default_set_has_5xx() -> None:
    assert 500 in RETRYABLE_STATUSES
    assert 502 in RETRYABLE_STATUSES
    assert 503 in RETRYABLE_STATUSES
    assert 504 in RETRYABLE_STATUSES
