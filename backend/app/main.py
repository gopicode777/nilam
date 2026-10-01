from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .auth import current_user
from .config import settings
from .db import init_db
from .ratelimit import RateLimit
from .routers import cases, documents, misc


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Nilam - Tamil Nadu Land Audit API", version="1.0.0", lifespan=lifespan,
    description="Evidence-first land audit: upload documents, extract & confirm fields, run rules, map checks, AI Q&A.",
    docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json",
)
app.add_middleware(CORSMiddleware, allow_origins=[settings.client_origin], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    csp = "default-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'self'; base-uri 'self'"
    if not request.url.path.startswith("/api/docs") and not request.url.path.startswith("/api/redoc"):  # Swagger UI loads from a CDN
        resp.headers["Content-Security-Policy"] = csp
    resp.headers.update({"X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN"})
    if settings.production:
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return resp


# Keep one error shape for the frontend: {"error": "..."}
@app.exception_handler(HTTPException)
async def http_error(_, e: HTTPException):
    return JSONResponse({"error": e.detail}, status_code=e.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_, e: RequestValidationError):
    msg = "; ".join(f"{'.'.join(str(p) for p in x['loc'][1:])}: {x['msg']}" for x in e.errors())
    return JSONResponse({"error": msg}, status_code=422)


@app.exception_handler(Exception)
async def unhandled(_, e: Exception):
    import logging
    logging.getLogger("nilam").exception("Unhandled error", exc_info=e)
    return JSONResponse({"error": "Something went wrong"}, status_code=500)


api = APIRouter(prefix="/api", dependencies=[Depends(RateLimit(300)), Depends(current_user)])
api.include_router(cases.router)
api.include_router(documents.router)
api.include_router(misc.router)
app.include_router(api)


@app.get("/api/health", tags=["System"])
def health():
    return {"ok": True}


# Serve the built React app in production (client/dist), with SPA fallback.
_dist = Path(__file__).resolve().parents[2] / "client" / "dist"
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = (_dist / path).resolve()
        return FileResponse(f if f.is_file() and _dist in f.parents else _dist / "index.html")
