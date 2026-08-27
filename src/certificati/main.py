from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
import sqlite3
import threading
import webbrowser

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from certificati.backtest import run_backtest
from certificati.database import check_database

PROJECT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_DIR / "data"
DATABASE_PATH = DATA_DIR / "russell_prices.sqlite"
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ASSETS_DIR = STATIC_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


class BacktestRequest(BaseModel):
    start_date: date = date(2016, 1, 4)
    end_date: date = date(2026, 7, 31)
    target_open_trades: int = Field(60, ge=1)
    min_maturity_months: int = Field(6, ge=1)
    max_maturity_months: int = Field(12, ge=1)
    barrier: float = Field(60, gt=0)
    airbag: bool = True
    autocall: bool = True
    autocall_level_one: float = Field(90, ge=0)
    autocall_step_down: float = Field(5, ge=0)
    autocall_floor: float = Field(75, ge=0)
    coupon_trigger: bool = True
    coupon_trigger_level: float = Field(75, ge=0)
    annual_coupon: float = Field(0.20, ge=0)
    initial_capital: float = Field(1_000_000, gt=0)
    risk_free_rate: float = Field(0.05, ge=0)
    tickers: list[str] | None = None
    random_basket_size: int = Field(3, ge=1, le=5)


@app.get("/api/tickers")
def search_tickers(query: str = "", limit: int = 20):
    """Return ticker symbols for the custom-basket picker."""
    limit = max(1, min(limit, 100))
    pattern = f"{query.strip().upper()}%"

    with sqlite3.connect(DATABASE_PATH) as database:
        rows = database.execute(
            """
            SELECT ticker, first_date, last_date
            FROM tickers
            WHERE ticker LIKE ?
            ORDER BY ticker
            LIMIT ?
            """,
            (pattern, limit),
        ).fetchall()

    return [
        {"ticker": ticker, "first_date": first_date, "last_date": last_date}
        for ticker, first_date, last_date in rows
    ]


@app.post("/api/backtest")
def create_backtest(request: BacktestRequest):
    """Run a backtest and return the complete result in the response."""
    try:
        return run_backtest(**request.model_dump(), database_path=DATABASE_PATH)
    except (ValueError, RuntimeError, sqlite3.Error) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/{path:path}", include_in_schema=False)
def serve_frontend(path: str):
    return FileResponse(STATIC_DIR / "index.html")


def main():
    check_database(DATA_DIR)

    host = "127.0.0.1"
    port = 8044
    url = f"http://{host}:{port}"
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run("certificati.main:app", host=host, port=port)

if __name__ == "__main__":
    main()
