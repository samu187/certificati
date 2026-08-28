"""Persistence helpers for completed command-line analyses."""

from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any


def save_backtest_result(result: dict[str, Any], data_directory: Path) -> Path:
    """Atomically save one complete backtest result and return its path."""
    results_directory = data_directory / "backtests"
    results_directory.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    result_path = results_directory / f"backtest-{timestamp}.json"
    temporary_path = result_path.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    temporary_path.replace(result_path)
    return result_path
