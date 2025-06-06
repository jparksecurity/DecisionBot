import asyncio
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List
import logging

import whisper
from whisper.audio import load_audio

from ..models.schemas import TranscriptionJob, JobStatus, WhisperConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service for managing audio transcription jobs using Whisper"""
    
    def __init__(self):
        self.jobs: Dict[str, TranscriptionJob] = {}
        self.whisper_model = None
        self.config = WhisperConfig(
            model_name=os.getenv("WHISPER_MODEL", "base"),
            device=os.getenv("WHISPER_DEVICE", "cpu")
        )
        self.upload_dir = Path(os.getenv("UPLOAD_DIR", "/tmp/bytenite_uploads"))
        self.max_file_size_mb = int(os.getenv("MAX_FILE_SIZE_MB", "100"))
        self.processing_queue = asyncio.Queue()
        self.worker_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """Initialize the transcription service"""
        try:
            # Create upload directory
            self.upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Load Whisper model
            logger.info(f"Loading Whisper model: {self.config.model_name}")
            self.whisper_model = whisper.load_model(
                self.config.model_name,
                device=self.config.device
            )
            logger.info("Whisper model loaded successfully")
            
            # Start background worker
            self.worker_task = asyncio.create_task(self._process_jobs())
            logger.info("Transcription service initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize transcription service: {e}")
            raise
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
        
        # Clean up temporary files
        for job in self.jobs.values():
            if job.file_path and Path(job.file_path).exists():
                try:
                    Path(job.file_path).unlink()
                except Exception as e:
                    logger.warning(f"Failed to cleanup file {job.file_path}: {e}")
        
        logger.info("Transcription service cleaned up")
    
    async def create_job(self, audio_data: bytes, user_id: str, filename: str) -> str:
        """Create a new transcription job"""
        
        # Check file size
        if len(audio_data) > self.max_file_size_mb * 1024 * 1024:
            raise ValueError(f"File too large: {len(audio_data)} bytes (max: {self.max_file_size_mb}MB)")
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Save audio file
        file_path = self.upload_dir / f"{job_id}_{filename}"
        
        try:
            with open(file_path, "wb") as f:
                f.write(audio_data)
            
            # Create job
            job = TranscriptionJob(
                id=job_id,
                user_id=user_id,
                filename=filename,
                status=JobStatus.QUEUED,
                created_at=datetime.utcnow(),
                file_path=str(file_path)
            )
            
            self.jobs[job_id] = job
            
            # Add to processing queue
            await self.processing_queue.put(job_id)
            
            logger.info(f"Created transcription job {job_id} for user {user_id}")
            return job_id
            
        except Exception as e:
            # Cleanup file if job creation failed
            if file_path.exists():
                file_path.unlink()
            raise ValueError(f"Failed to create transcription job: {e}")
    
    async def get_job_status(self, job_id: str) -> Optional[TranscriptionJob]:
        """Get job status"""
        return self.jobs.get(job_id)
    
    async def delete_job(self, job_id: str) -> bool:
        """Delete a job and cleanup files"""
        job = self.jobs.get(job_id)
        if not job:
            return False
        
        # Cleanup file
        if job.file_path and Path(job.file_path).exists():
            try:
                Path(job.file_path).unlink()
            except Exception as e:
                logger.warning(f"Failed to delete file {job.file_path}: {e}")
        
        # Remove from jobs
        del self.jobs[job_id]
        logger.info(f"Deleted job {job_id}")
        return True
    
    async def list_jobs(self) -> List[Dict]:
        """List all jobs (for debugging)"""
        return [
            {
                "id": job.id,
                "user_id": job.user_id,
                "status": job.status,
                "created_at": job.created_at.isoformat(),
                "filename": job.filename
            }
            for job in self.jobs.values()
        ]
    
    async def _process_jobs(self):
        """Background worker to process transcription jobs"""
        logger.info("Started transcription worker")
        
        while True:
            try:
                # Get next job from queue
                job_id = await self.processing_queue.get()
                job = self.jobs.get(job_id)
                
                if not job:
                    logger.warning(f"Job {job_id} not found, skipping")
                    continue
                
                if job.status != JobStatus.QUEUED:
                    logger.warning(f"Job {job_id} not in queued status: {job.status}")
                    continue
                
                # Process the job
                await self._transcribe_audio(job)
                
            except asyncio.CancelledError:
                logger.info("Transcription worker cancelled")
                break
            except Exception as e:
                logger.error(f"Error in transcription worker: {e}")
                # Continue processing other jobs
    
    async def _transcribe_audio(self, job: TranscriptionJob):
        """Transcribe audio for a specific job"""
        try:
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            
            logger.info(f"Starting transcription for job {job.id}")
            
            if not job.file_path or not Path(job.file_path).exists():
                raise FileNotFoundError(f"Audio file not found: {job.file_path}")
            
            # Load and transcribe audio
            # Run in thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._transcribe_with_whisper, 
                job.file_path
            )
            
            # Update job with results
            job.transcript = result["text"].strip()
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
            logger.info(f"Transcription completed for job {job.id}: {len(job.transcript)} characters")
            
            # Cleanup file after successful transcription
            try:
                Path(job.file_path).unlink()
                job.file_path = None
            except Exception as e:
                logger.warning(f"Failed to cleanup file after transcription: {e}")
            
        except Exception as e:
            logger.error(f"Transcription failed for job {job.id}: {e}")
            job.status = JobStatus.FAILED
            job.error = str(e)
            job.completed_at = datetime.utcnow()
            
            # Cleanup file after failed transcription
            try:
                if job.file_path and Path(job.file_path).exists():
                    Path(job.file_path).unlink()
                    job.file_path = None
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup file after error: {cleanup_error}")
    
    def _transcribe_with_whisper(self, file_path: str) -> dict:
        """Synchronous transcription with Whisper (runs in thread pool)"""
        try:
            # Load audio
            audio = load_audio(file_path)
            
            # Transcribe
            result = self.whisper_model.transcribe(
                audio,
                language=self.config.language,
                task=self.config.task,
                verbose=False
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            raise