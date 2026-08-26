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

The app runs at `http://127.0.0.1:8044` and opens in the default browser automatically.

On its first run, the app creates `data/russell_prices.sqlite`. It loads the
tickers from `data/russell_tickers.csv`, makes one yfinance download call for
daily OHLCV prices from Yahoo Finance for 1 January 2016 through 31 July 2026,
and records each ticker's first and last available price dates. yfinance sends
the underlying Yahoo requests serially to avoid a rate-limit burst. Later starts
reuse the populated database.

## Project structure

```text
src/certificati/
  main.py                 FastAPI app entry point
  database.py             First-run SQLite database setup and price download
  static/                 Built frontend served by FastAPI

data/
  russell_tickers.csv     Russell ticker list (source input)
  russell_prices.sqlite   Generated price database

frontend/
  src/                    React source
  vite.config.js          Builds into src/certificati/static
```
