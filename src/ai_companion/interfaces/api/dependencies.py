# ai_companion/interfaces/api/dependencies.py
from fastapi import Request, HTTPException

# Shared global application state dictionary
app_state = {}

def get_graph():
    """Retrieves the pre-compiled graph from state memory."""
    graph = app_state.get("graph")
    if not graph:
        raise HTTPException(status_code=503, detail="AI Graph engine is not fully initialized.")
    return graph