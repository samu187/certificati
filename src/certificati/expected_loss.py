"""Monthly worst-of performance scenarios for a fixed three-stock basket."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sqlite3


WINDOW_MONTHS = 12


@dataclass(frozen=True)
class MonthlyScenario:
    """One rolling 12-month first-trading-day observation window."""

    start_date: str
    end_date: str
    spy_return: float
    ticker_1_return: float
    ticker_2_return: float
    ticker_3_return: float
    worst_return: float
    performance: float
    loss: float


def monthly_worst_of_scenarios(
    database_path: Path,
    tickers: list[str],
    barrier: int = 60,
    airbag: bool = False,
) -> list[MonthlyScenario]:
    """Return all completed rolling 12-month scenarios, ordered by SPY return.

    A boundary is SPY's first available trading date in a calendar month.  This
    deliberately gives every series the same start/end dates rather than using
    a different date for a stock that did not trade on a boundary.
    """
    normalised_tickers = _normalise_tickers(tickers)
    if len(normalised_tickers) != 3:
        raise ValueError("Provide exactly three distinct tickers.")
    if barrier <= 0:
        raise ValueError("Barrier must be greater than zero.")

    with sqlite3.connect(database_path) as connection:
        boundaries = _month_boundaries(connection)
        prices = _prices_at_boundaries(connection, normalised_tickers, boundaries)

    scenarios = []
    for start_date, end_date in zip(boundaries, boundaries[WINDOW_MONTHS:]):
        spy_start, spy_end = prices["SPY"][start_date], prices["SPY"][end_date]
        ticker_returns = [
            _return(prices[ticker][start_date], prices[ticker][end_date])
            for ticker in normalised_tickers
        ]
        worst_return = min(ticker_returns)
        performance = (1 + worst_return) * 100
        scenarios.append(
            MonthlyScenario(
                start_date=start_date,
                end_date=end_date,
                spy_return=_return(spy_start, spy_end),
                ticker_1_return=ticker_returns[0],
                ticker_2_return=ticker_returns[1],
                ticker_3_return=ticker_returns[2],
                worst_return=worst_return,
                performance=performance,
                loss=_loss(performance, barrier, airbag),
            )
        )

    return sorted(scenarios, key=lambda scenario: scenario.spy_return)


def _month_boundaries(connection: sqlite3.Connection) -> list[str]:
    """Get every available first-SPY-trading-day monthly boundary."""
    rows = connection.execute(
        """
        SELECT date
        FROM (
            SELECT date, ROW_NUMBER() OVER (
                PARTITION BY substr(date, 1, 7) ORDER BY date
            ) AS day_in_month
            FROM spy
            WHERE close IS NOT NULL
        )
        WHERE day_in_month = 1
        ORDER BY date
        """,
    ).fetchall()
    boundaries = [row[0] for row in rows]
    if len(boundaries) <= WINDOW_MONTHS:
        raise RuntimeError("SPY history does not contain a completed 12-month period.")
    return boundaries


def _prices_at_boundaries(
    connection: sqlite3.Connection,
    tickers: list[str],
    boundaries: list[str],
) -> dict[str, dict[str, float]]:
    placeholders = ", ".join("?" for _ in boundaries)
    prices: dict[str, dict[str, float]] = {}

    spy_rows = connection.execute(
        f"SELECT date, close FROM spy WHERE date IN ({placeholders})", boundaries
    ).fetchall()
    prices["SPY"] = {price_date: float(close) for price_date, close in spy_rows if close is not None}

    for ticker in tickers:
        rows = connection.execute(
            f"""
            SELECT date, close FROM prices
            WHERE ticker = ? AND date IN ({placeholders})
            """,
            (ticker, *boundaries),
        ).fetchall()
        prices[ticker] = {price_date: float(close) for price_date, close in rows if close is not None}

    for ticker, ticker_prices in prices.items():
        missing = [boundary for boundary in boundaries if boundary not in ticker_prices]
        if missing:
            raise RuntimeError(
                f"{ticker} has no closing price on required SPY trading date(s): "
                f"{', '.join(missing)}."
            )
    return prices


def _normalise_tickers(tickers: list[str]) -> list[str]:
    normalised = [ticker.strip().upper() for ticker in tickers if ticker.strip()]
    if len(normalised) != len(set(normalised)):
        raise ValueError("Tickers must be distinct.")
    return normalised


def _return(start_price: float, end_price: float) -> float:
    return end_price / start_price - 1


def _loss(performance: float, barrier: int, airbag: bool) -> float:
    if performance >= barrier:
        return 0.0
    return 1 - performance / (barrier if airbag else 100)
