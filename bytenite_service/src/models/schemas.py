from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobResponse(BaseModel):
    jobId: str = Field(..., description="Unique job identifier")
    status: JobStatus = Field(..., description="Current job status")
    transcript: Optional[str] = Field(None, description="Transcribed text (only when completed)")
    error: Optional[str] = Field(None, description="Error message (only when failed)")
    message: Optional[str] = Field(None, description="Additional status message")


class TranscriptionJob(BaseModel):
    id: str
    user_id: str
    filename: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    transcript: Optional[str] = None
    error: Optional[str] = None
    file_path: Optional[str] = None
    
    class Config:
        use_enum_values = True


class TranscriptionRequest(BaseModel):
    audio_data: bytes
    user_id: str
    filename: str


class WhisperConfig(BaseModel):
    model_name: str = "base"
    device: str = "cpu"
    language: Optional[str] = None
    task: str = "transcribe"  # "transcribe" or "translate"
    
    class Config:
        extra = "allow"