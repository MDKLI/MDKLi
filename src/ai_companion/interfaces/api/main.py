# =====================================================================
# CRITICAL STEP 1: MUST BE AT THE ABSOLUTE TOP BEFORE ANY LOCAL IMPORTS
# =====================================================================
import os
from pathlib import Path
from dotenv import load_dotenv

# Points to D:\mdkli\mdkli (4 folders up from /interfaces/api/main.py)
root_dir = Path(__file__).resolve().parents[4]
env_path = root_dir / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    print(f"⚠️ Warning: .env file not found at {env_path}")

# =====================================================================
# STEP 2: Standard Python & FastAPI imports
# =====================================================================
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# =====================================================================
# STEP 3: Local imports (Safe now because env vars are in system memory)
# =====================================================================
from ai_companion.graph import graph_builder
from ai_companion.settings import settings
from ai_companion.interfaces.api.dependencies import app_state
from ai_companion.interfaces.api.routes import chat

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_companion_api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing system database paths and graph configurations...")
    
    db_path = Path(settings.SHORT_TERM_MEMORY_DB_PATH)
    if not db_path.is_absolute():
        db_path = root_dir / settings.SHORT_TERM_MEMORY_DB_PATH

    db_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"Using checkpointer target database: {db_path}")

    saver = AsyncSqliteSaver.from_conn_string(str(db_path))
    saver_context = await saver.__aenter__()
    
    app_state["graph"] = graph_builder.compile(checkpointer=saver_context)
    app_state["saver_instance"] = saver
    
    logger.info("LangGraph background configurations compiled successfully!")
    yield
    
    logger.info("Graceful Shutdown: Closing DB engine locks...")
    await app_state["saver_instance"].__aexit__(None, None, None)


app = FastAPI(
    title="MDKLi API",
    version="1.0",
    lifespan=lifespan,
    # Add these lines to fix the blank screen/loading issue
    swagger_ui_html_to_file=None,
    swagger_ui_parameters={"syntaxHighlight.theme": "obsidian"},
)

# Overwrite FastAPI's internal CDN endpoints with a reliable fallback mirror
from fastapi.openapi.docs import get_swagger_ui_html

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.js",
        swagger_css_url="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.css",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_companion.interfaces.api.main:app", host="0.0.0.0", port=8000, reload=True)