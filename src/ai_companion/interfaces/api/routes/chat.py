# ai_companion/interfaces/api/routes/chat.py
import json
import logging
from io import BytesIO
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import AIMessageChunk, HumanMessage

from ai_companion.interfaces.api.dependencies import get_graph
from ai_companion.modules.image import ImageToText
from ai_companion.modules.speech import SpeechToText, TextToSpeech

logger = logging.getLogger("ai_companion_api")

# Create router instance with prefixing
router = APIRouter(prefix="/v1/chat", tags=["Chat & Multimodal Core"])

# One-time initialization of modules
speech_to_text = SpeechToText()
text_to_speech = TextToSpeech()
image_to_text = ImageToText()


class ChatRequest(BaseModel):
    text: str
    thread_id: str = "1"


@router.post("/text")
async def chat_text(request: ChatRequest, graph = Depends(get_graph)):
    """Standard Non-Streaming text endpoint."""
    try:
        output_state = await graph.ainvoke(
            {"messages": [HumanMessage(content=request.text)]},
            {"configurable": {"thread_id": request.thread_id}},
        )
        
        workflow = output_state.get("workflow", "text")
        response_data = {
            "workflow": workflow,
            "text": output_state["messages"][-1].content
        }

        if workflow == "audio" and "audio_buffer" in output_state:
            response_data["audio_url"] = "/v1/assets/audio_placeholder"
        elif workflow == "image" and "image_path" in output_state:
            response_data["image_path"] = output_state["image_path"]

        return response_data

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(request: ChatRequest, graph = Depends(get_graph)):
    """Streaming Endpoint using Server-Sent Events (SSE)."""
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for chunk in graph.astream(
                {"messages": [HumanMessage(content=request.text)]},
                {"configurable": {"thread_id": request.thread_id}},
                stream_mode="messages",
            ):
                if chunk[1]["langgraph_node"] == "conversation_node" and isinstance(chunk[0], AIMessageChunk):
                    yield f"data: {json.dumps({'token': chunk[0].content})}\n\n"
            
            output_state = await graph.aget_state(config={"configurable": {"thread_id": request.thread_id}})
            workflow = output_state.values.get("workflow", "text")
            yield f"data: {json.dumps({'status': 'done', 'workflow': workflow})}\n\n"

        except Exception as e:
            logger.error(f"Streaming failed: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/multimodal")
async def chat_multimodal(
    thread_id: str = Form("1"),
    text: Optional[str] = Form(""),
    file: UploadFile = File(None),
    graph = Depends(get_graph)
):
    """Handles Multi-part form uploads using cached graph instance."""
    content = text or ""
    
    if file:
        file_bytes = await file.read()
        mime_type = file.content_type
        
        if mime_type.startswith("image/"):
            try:
                description = await image_to_text.analyze_image(
                    file_bytes,
                    "Please describe what you see in this image in the context of our conversation.",
                )
                content += f"\n[Image Analysis: {description}]"
            except Exception as e:
                logger.warning(f"Failed to analyze image: {e}")
                
        elif mime_type.startswith("audio/"):
            try:
                transcription = await speech_to_text.transcribe(file_bytes)
                content += f" {transcription}".strip()
            except Exception as e:
                logger.error(f"Transcription failed: {e}")
                raise HTTPException(status_code=400, detail="Audio file could not be processed.")

    if not content:
        raise HTTPException(status_code=400, detail="No content parsed or provided.")

    output_state = await graph.ainvoke(
        {"messages": [HumanMessage(content=content)]},
        {"configurable": {"thread_id": thread_id}},
    )
    
    response_text = output_state["messages"][-1].content
    workflow = output_state.get("workflow", "text")
    
    if workflow == "audio":
        audio_out_bytes = await text_to_speech.synthesize(response_text)
        return StreamingResponse(BytesIO(audio_out_bytes), media_type="audio/mpeg")

    return {
        "workflow": workflow,
        "text": response_text,
        "image_path": output_state.get("image_path") if workflow == "image" else None
    }