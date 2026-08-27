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

`uv run certificati web` explicitly launches the same web application.
`uv run certificati mcp` and `uv run certificati backtest` are placeholders for
future interfaces.

On its first command, Certificati asks before creating `russell_prices.sqlite` in the
current user's application-data directory: `~/Library/Application Support/Certificati`
on macOS and `%LOCALAPPDATA%\\Certificati` on Windows. It loads the ticker list
packaged with the application, makes one yfinance download call for
daily OHLCV prices from Yahoo Finance for 1 January 2016 through 31 July 2026,
and records each ticker's first and last available price dates. yfinance sends
the underlying Yahoo requests serially to avoid a rate-limit burst. Later starts
reuse the populated database.

## Project structure

```text
src/certificati/
  main.py                 Typer command-line entry point
  web.py                  FastAPI web application
  database.py             First-run SQLite database setup and price download
  russell_tickers.csv     Packaged ticker-list resource
  static/                 Built frontend served by FastAPI

frontend/
  src/                    React source
  vite.config.js          Builds into src/certificati/static
```
