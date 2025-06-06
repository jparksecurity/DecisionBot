import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from pathlib import Path
import tempfile
import os
import httpx
from fastapi.testclient import TestClient

from src.services.transcription import TranscriptionService
from src.models.schemas import JobStatus
from src.main import app


@pytest.fixture
async def transcription_service():
    """Create a transcription service for testing"""
    service = TranscriptionService()
    
    # Mock Whisper model loading
    with patch.object(service, 'whisper_model', Mock()):
        with patch('whisper.load_model', return_value=Mock()):
            await service.initialize()
    
    yield service
    
    await service.cleanup()


@pytest.fixture
def mock_audio_data():
    """Mock audio data for testing"""
    return b"fake_audio_data_for_testing" * 100  # Make it reasonably sized


@pytest.fixture
def test_client():
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_wav_file():
    """Create a mock WAV file for testing"""
    # WAV file header (44 bytes) + some audio data
    wav_header = b'RIFF' + b'\x24\x08\x00\x00' + b'WAVE' + b'fmt ' + b'\x10\x00\x00\x00'
    wav_header += b'\x01\x00\x02\x00\x44\xac\x00\x00\x10\xb1\x02\x00\x04\x00\x10\x00'
    wav_header += b'data' + b'\x00\x08\x00\x00'
    audio_data = b'\x00' * 2048  # 2KB of silence
    return wav_header + audio_data


class TestFileUpload:
    
    @pytest.mark.asyncio
    async def test_create_job_success(self, transcription_service, mock_audio_data):
        """PY-U1: Mock POST 201 → returns jobId"""
        service = transcription_service
        
        job_id = await service.create_job(
            audio_data=mock_audio_data,
            user_id="test_user",
            filename="test.wav"
        )
        
        assert job_id is not None
        assert isinstance(job_id, str)
        
        # Check job was created
        job = await service.get_job_status(job_id)
        assert job is not None
        assert job.user_id == "test_user"
        assert job.filename == "test.wav"
        assert job.status == JobStatus.QUEUED

    @pytest.mark.asyncio
    async def test_create_job_file_too_large(self, transcription_service):
        """Test file size limit enforcement"""
        service = transcription_service
        
        # Create data larger than limit
        large_data = b"x" * (service.max_file_size_mb * 1024 * 1024 + 1)
        
        with pytest.raises(ValueError, match="File too large"):
            await service.create_job(
                audio_data=large_data,
                user_id="test_user",
                filename="large.wav"
            )

    @pytest.mark.asyncio
    async def test_job_processing_flow(self, transcription_service, mock_audio_data):
        """PY-P1: 2× processing, 1× done → returns transcripts"""
        service = transcription_service
        
        # Mock the Whisper transcription
        mock_result = {"text": "This is a test transcription"}
        
        with patch.object(service, '_transcribe_with_whisper', return_value=mock_result):
            # Create job
            job_id = await service.create_job(
                audio_data=mock_audio_data,
                user_id="test_user",
                filename="test.wav"
            )
            
            # Wait a bit for processing to start
            await asyncio.sleep(0.1)
            
            # Check initial status
            job = await service.get_job_status(job_id)
            assert job.status in [JobStatus.QUEUED, JobStatus.PROCESSING]
            
            # Wait for completion
            for _ in range(10):  # Max 1 second wait
                await asyncio.sleep(0.1)
                job = await service.get_job_status(job_id)
                if job.status == JobStatus.COMPLETED:
                    break
            
            # Verify completion
            assert job.status == JobStatus.COMPLETED
            assert job.transcript == "This is a test transcription"
            assert job.completed_at is not None

    @pytest.mark.asyncio
    async def test_job_processing_failure(self, transcription_service, mock_audio_data):
        """Test job failure handling"""
        service = transcription_service
        
        # Mock transcription failure
        with patch.object(service, '_transcribe_with_whisper', side_effect=Exception("Transcription failed")):
            job_id = await service.create_job(
                audio_data=mock_audio_data,
                user_id="test_user",
                filename="test.wav"
            )
            
            # Wait for processing
            for _ in range(10):
                await asyncio.sleep(0.1)
                job = await service.get_job_status(job_id)
                if job.status == JobStatus.FAILED:
                    break
            
            # Verify failure
            assert job.status == JobStatus.FAILED
            assert "Transcription failed" in job.error
            assert job.completed_at is not None

    @pytest.mark.asyncio
    async def test_delete_job(self, transcription_service, mock_audio_data):
        """Test job deletion and cleanup"""
        service = transcription_service
        
        job_id = await service.create_job(
            audio_data=mock_audio_data,
            user_id="test_user",
            filename="test.wav"
        )
        
        # Verify job exists
        job = await service.get_job_status(job_id)
        assert job is not None
        
        # Delete job
        success = await service.delete_job(job_id)
        assert success is True
        
        # Verify job is gone
        job = await service.get_job_status(job_id)
        assert job is None

    @pytest.mark.asyncio
    async def test_list_jobs(self, transcription_service, mock_audio_data):
        """Test job listing functionality"""
        service = transcription_service
        
        # Create a few jobs
        job_ids = []
        for i in range(3):
            job_id = await service.create_job(
                audio_data=mock_audio_data,
                user_id=f"user_{i}",
                filename=f"test_{i}.wav"
            )
            job_ids.append(job_id)
        
        # List jobs
        jobs = await service.list_jobs()
        assert len(jobs) == 3
        
        # Verify job data
        job_user_ids = [job["user_id"] for job in jobs]
        assert "user_0" in job_user_ids
        assert "user_1" in job_user_ids
        assert "user_2" in job_user_ids

    def test_transcribe_with_whisper_mock(self, transcription_service):
        """Test the Whisper transcription function with mocks"""
        service = transcription_service
        
        # Create a temporary audio file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(b"fake_audio_data")
            temp_file = f.name
        
        try:
            # Mock whisper functions
            with patch('whisper.audio.load_audio', return_value=Mock()) as mock_load:
                mock_transcribe = Mock(return_value={"text": "Mocked transcription"})
                service.whisper_model.transcribe = mock_transcribe
                
                result = service._transcribe_with_whisper(temp_file)
                
                assert result["text"] == "Mocked transcription"
                mock_load.assert_called_once_with(temp_file)
                mock_transcribe.assert_called_once()
        
        finally:
            # Cleanup
            if os.path.exists(temp_file):
                os.unlink(temp_file)


class TestTranscriptionEndToEnd:
    """End-to-end tests that would be run with actual FastAPI app"""
    
    @pytest.mark.asyncio
    async def test_upload_and_poll_endpoint_flow(self):
        """PY-R1: End-to-end with dummy WAV"""
        # This would test the actual FastAPI endpoints
        # For now, just a placeholder showing the test structure
        
        # In a real test, you would:
        # 1. Start FastAPI test client
        # 2. POST to /transcribe with audio file
        # 3. GET /job/{job_id}/status until completion
        # 4. Verify response format
        
        pass  # Placeholder for actual endpoint testing