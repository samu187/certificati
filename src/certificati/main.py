from contextlib import asynccontextmanager
from pathlib import Path
import threading
import webbrowser

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from certificati.database import check_database

PROJECT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_DIR / "data"
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ASSETS_DIR = STATIC_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


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
