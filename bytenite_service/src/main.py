import asyncio
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Any

import uvicorn
import whisper
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .models.schemas import JobResponse, JobStatus, TranscriptionJob
from .services.transcription import TranscriptionService


# Global transcription service instance
transcription_service: TranscriptionService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic"""
    global transcription_service
    
    # Startup
    print("Initializing ByteNite transcription service...")
    transcription_service = TranscriptionService()
    await transcription_service.initialize()
    print("ByteNite service ready!")
    
    yield
    
    # Shutdown
    print("Shutting down ByteNite service...")
    await transcription_service.cleanup()


app = FastAPI(
    title="ByteNite Transcription Service",
    description="Audio transcription service using OpenAI Whisper",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "bytenite-transcription"}


@app.post("/transcribe", response_model=JobResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    user_id: str = Form(...)
) -> JobResponse:
    """
    Upload audio file for transcription
    
    Args:
        file: Audio file (WAV format preferred)
        user_id: ID of the user who spoke in the audio
        
    Returns:
        Job ID for polling transcription status
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    allowed_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg'}
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_ext}. Allowed: {allowed_extensions}"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Create transcription job
        job_id = await transcription_service.create_job(content, user_id, file.filename)
        
        return JobResponse(
            jobId=job_id,
            status=JobStatus.QUEUED,
            message="Transcription job created successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create transcription job: {str(e)}")


@app.get("/job/{job_id}/status", response_model=JobResponse)
async def get_job_status(job_id: str) -> JobResponse:
    """
    Get transcription job status
    
    Args:
        job_id: Job ID returned from transcribe endpoint
        
    Returns:
        Current job status and transcript if completed
    """
    try:
        job = await transcription_service.get_job_status(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        response_data = {
            "jobId": job_id,
            "status": job.status,
        }
        
        if job.status == JobStatus.COMPLETED:
            response_data["transcript"] = job.transcript
            response_data["message"] = "Transcription completed successfully"
        elif job.status == JobStatus.FAILED:
            response_data["error"] = job.error
            response_data["message"] = "Transcription failed"
        elif job.status == JobStatus.PROCESSING:
            response_data["message"] = "Transcription in progress"
        else:
            response_data["message"] = "Job queued for processing"
        
        return JobResponse(**response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")


@app.delete("/job/{job_id}")
async def delete_job(job_id: str):
    """
    Delete a transcription job and cleanup resources
    
    Args:
        job_id: Job ID to delete
    """
    try:
        success = await transcription_service.delete_job(job_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {"message": "Job deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {str(e)}")


@app.get("/jobs")
async def list_jobs():
    """List all active jobs (for debugging)"""
    try:
        jobs = await transcription_service.list_jobs()
        return {"jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")


if __name__ == "__main__":
    # For development
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )