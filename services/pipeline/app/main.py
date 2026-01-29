"""Minimal FastAPI service for document pipeline prototype.
- /health responds with a simple JSON to verify service availability
- /convert is a placeholder for future document extraction endpoints
"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="muse-pipeline")


class ConvertRequest(BaseModel):
    # Placeholder schema; real fields to be added later
    document_url: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pipeline"}


@app.post("/convert")
async def convert(req: ConvertRequest):
    # Business logic will be implemented later. Return a placeholder response for now.
    return {"status": "ok", "message": "conversion endpoint placeholder", "document_url": req.document_url}
