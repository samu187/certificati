# Certificati

A local FastAPI and React application.

## Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js and npm

## Setup

Install Python dependencies:

```bash
uv sync
```

Install frontend dependencies and create the production build:

```bash
cd frontend
npm install
npm run build
```

## Run

```bash
uv run certificati
```

`cert` is an equivalent shorter command:

```bash
uv run cert
```

The app runs at `http://127.0.0.1:8044` and opens in the default browser automatically.

`uv run certificati web` (or `uv run cert web`) explicitly launches the same web application.
`uv run certificati mcp` and `uv run certificati expected-loss` are
placeholders for future interfaces. The backtest can be run directly from the
terminal; all inputs are optional and use the strategy builder's defaults:

```bash
uv run cert backtest
uv run cert backtest AAPL META NVDA --no-autocall --no-coupon-trigger --seed 1
uv run cert expected-loss AAPL META NVDA
uv run cert expected-loss AAPL META NVDA --barrier 70 --airbag
```

`expected-loss` prints every completed rolling 12-month period, ordered by SPY
return. A period begins on SPY's first trading day in a calendar month and ends
on SPY's first trading day in the same month a year later. With the bundled
history, this starts at January 2016 → January 2017 and runs through July 2025
→ July 2026. It shows SPY, each selected stock, the basket's worst return,
performance, and loss. Performance is `(1 + worst return) * 100`. Loss is zero
above the barrier; below it, it is `1 - performance / 100` by default, or
`1 - performance / barrier` with `--airbag`. The command also prints average
loss across all periods, SPY-negative periods, SPY-positive periods, and
neutral SPY periods (−7.5% to +7.5%). Use `--barrier 60` to set the barrier
(60 is the default).

The terminal displays headline realised metrics. Every complete result is also
saved as a timestamped JSON file in the application's `backtests` data folder,
ready for later CLI inspection commands.

On its first command, Certificati asks before creating `russell_prices.sqlite` in the
current user's application-data directory: `~/Library/Application Support/Certificati`
on macOS and `%LOCALAPPDATA%\\Certificati` on Windows. It loads the ticker list
packaged with the application, makes one yfinance download call for
daily OHLCV prices from Yahoo Finance for 1 January 2016 through 31 July 2026,
and records each ticker's first and last available price dates. yfinance sends
the underlying Yahoo requests serially to avoid a rate-limit burst. Later starts
reuse the populated database.

### Querying price data

Run SQL directly against the local price database with `query`. Results are shown
with column headers in a boxed table, like SQLite's `.headers on` and `.mode box`.

```bash
cert query "SELECT ticker, first_date, last_date FROM tickers LIMIT 5"
cert query "SELECT date, close FROM prices WHERE ticker = 'AAPL' ORDER BY date DESC LIMIT 10"
```

## Project structure

```text
src/certificati/
  cli.py                  Typer command-line entry point
  web.py                  FastAPI web application
  database.py             First-run SQLite database setup and price download
  russell_tickers.csv     Packaged ticker-list resource
  static/                 Built frontend served by FastAPI

frontend/
  src/                    React source
  vite.config.js          Builds into src/certificati/static
```
