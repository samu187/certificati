"""Create and populate the local Russell 3000 price database."""

import csv
import math
from pathlib import Path
import sqlite3

import yfinance as yf


START_DATE = "2016-01-01"
# yfinance treats the end date as exclusive, so this includes 31 July 2026.
END_DATE = "2026-08-01"
MINIMUM_DOWNLOAD_COVERAGE = 0.95


def check_database(data_dir: Path) -> Path:
    """Create the price database on the first application startup only."""
    database_path = data_dir / "russell_prices.sqlite"
    if database_path.exists():
        return database_path

    tickers = read_tickers(data_dir / "russell_tickers.csv")
    temporary_path = database_path.with_suffix(".sqlite.tmp")
    temporary_path.unlink(missing_ok=True)

    try:
        create_database(temporary_path, tickers)
        temporary_path.replace(database_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise

    return database_path


def read_tickers(csv_path: Path) -> list[str]:
    with csv_path.open(newline="") as file:
        return [row["ticker"].strip() for row in csv.DictReader(file) if row["ticker"].strip()]


def create_database(database_path: Path, tickers: list[str]) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(database_path) as connection:
        create_tables(connection)
        connection.executemany("INSERT INTO tickers (ticker) VALUES (?)", ((ticker,) for ticker in tickers))

        downloaded_prices = download_prices(tickers)
        validate_download(downloaded_prices, tickers)
        insert_prices(connection, downloaded_prices, tickers)
        update_ticker_date_ranges(connection)


def create_tables(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE tickers (
            ticker TEXT PRIMARY KEY,
            first_date TEXT,
            last_date TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE prices (
            ticker TEXT NOT NULL,
            date TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            adj_close REAL,
            volume INTEGER,
            PRIMARY KEY (ticker, date),
            FOREIGN KEY (ticker) REFERENCES tickers (ticker)
        )
        """
    )


def download_prices(tickers: list[str]):
    """Ask yfinance for the full Russell ticker set in one download call.

    yfinance resolves symbols through Yahoo one at a time internally. Keeping its
    worker count to one avoids a burst of simultaneous Yahoo requests.
    """
    return yf.download(
        tickers=tickers,
        start=START_DATE,
        end=END_DATE,
        auto_adjust=False,
        group_by="ticker",
        progress=False,
        threads=False,
    )


def validate_download(downloaded_prices, tickers: list[str]) -> None:
    """Reject a rate-limited response rather than saving it as a complete database."""
    available_tickers = set(downloaded_prices.columns.get_level_values(0))
    downloaded_ticker_count = sum(
        ticker in available_tickers and not downloaded_prices[ticker].dropna(how="all").empty
        for ticker in tickers
    )
    coverage = downloaded_ticker_count / len(tickers)

    if coverage < MINIMUM_DOWNLOAD_COVERAGE:
        raise RuntimeError(
            "Yahoo Finance returned prices for "
            f"{downloaded_ticker_count:,} of {len(tickers):,} tickers ({coverage:.1%}). "
            "The response appears incomplete, so no database was created. "
            "Wait before trying again."
        )


def insert_prices(connection: sqlite3.Connection, downloaded_prices, tickers: list[str]) -> None:
    """Insert each ticker's result without holding millions of database rows in memory."""
    available_tickers = set(downloaded_prices.columns.get_level_values(0))

    for ticker in tickers:
        if ticker not in available_tickers:
            continue

        ticker_prices = downloaded_prices[ticker].dropna(how="all")
        rows = [
            (
                ticker,
                price_date.strftime("%Y-%m-%d"),
                nullable_float(values.get("Open")),
                nullable_float(values.get("High")),
                nullable_float(values.get("Low")),
                nullable_float(values.get("Close")),
                nullable_float(values.get("Adj Close")),
                nullable_integer(values.get("Volume")),
            )
            for price_date, values in ticker_prices.iterrows()
        ]
        connection.executemany(
            """
            INSERT INTO prices (ticker, date, open, high, low, close, adj_close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )


def nullable_float(value):
    return None if value is None or math.isnan(value) else float(value)


def nullable_integer(value):
    return None if value is None or math.isnan(value) else int(value)


def update_ticker_date_ranges(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        UPDATE tickers
        SET
            first_date = (SELECT MIN(date) FROM prices WHERE prices.ticker = tickers.ticker),
            last_date = (SELECT MAX(date) FROM prices WHERE prices.ticker = tickers.ticker)
        """
    )
