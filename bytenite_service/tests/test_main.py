#!/usr/bin/env python3
"""
Test suite for main.py - ByteNite transcription service
Implements test cases from Product Requirements Document section 11.2
"""

import pytest
import os
import json
import tempfile
import subprocess
import sys
from unittest.mock import patch, MagicMock, mock_open
from pathlib import Path

# Import the module under test
from app import main


class TestCoreFunctions:
    """Test core functionality - PY-C1 to PY-C4"""
    
    def test_install_requirements_success(self):
        """PY-C1: install_requirements() installs whisper and requests"""
        with patch('app.main.os.system') as mock_system:
            # Mock successful imports after installation
            with patch.dict('sys.modules', {'whisper': MagicMock(), 'requests': MagicMock()}):
                main.install_requirements()
                # Should not call os.system if modules already available
                mock_system.assert_not_called()
    
    def test_install_requirements_missing_deps(self):
        """PY-C1: install_requirements() installs missing dependencies"""
        with patch('app.main.os.system') as mock_system:
            # Simulate missing dependencies that get installed
            original_import = __builtins__['__import__']
            
            def mock_import(name, *args, **kwargs):
                if name == 'whisper':
                    raise ImportError("No module named 'whisper'")
                elif name == 'requests':
                    raise ImportError("No module named 'requests'")
                return original_import(name, *args, **kwargs)
            
            with patch('builtins.__import__', side_effect=mock_import):
                try:
                    main.install_requirements()
                except ImportError:
                    # Expected - import will fail even after pip install in test
                    pass
            
            mock_system.assert_called_once_with("pip install openai-whisper requests")
    
    def test_transcribe_audio_success(self):
        """PY-C2: transcribe_audio() with valid WAV file returns transcript"""
        # Mock the whisper module and its functions
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Hello world",
            "segments": [{"start": 0, "end": 2, "text": "Hello world"}],
            "language": "en"
        }
        
        with patch.dict('sys.modules', {'whisper': mock_whisper}):
            result = main.transcribe_audio("/fake/path/audio.wav")
            
            assert result["text"] == "Hello world"
            assert result["language"] == "en"
            assert len(result["segments"]) == 1
            mock_whisper.load_model.assert_called_once_with("base")
            mock_model.transcribe.assert_called_once_with("/fake/path/audio.wav")
    
    @patch('app.main.transcribe_audio')
    @patch('os.path.exists')
    def test_process_file_success(self, mock_exists, mock_transcribe):
        """PY-C3: process_file() with valid audio returns transcription result"""
        mock_exists.return_value = True
        mock_transcribe.return_value = {
            "text": "Test transcription",
            "segments": [],
            "language": "en"
        }
        
        result = main.process_file("/fake/input.wav")
        
        assert result["text"] == "Test transcription"
        mock_transcribe.assert_called_once_with("/fake/input.wav")
    
    @patch('app.main.transcribe_audio')
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    def test_process_file_with_output(self, mock_file, mock_exists, mock_transcribe):
        """PY-C4: process_file() with output path saves JSON file"""
        mock_exists.return_value = True
        mock_transcribe.return_value = {
            "text": "Test transcription",
            "segments": [],
            "language": "en"
        }
        
        result = main.process_file("/fake/input.wav", "/fake/output.json")
        
        assert result["text"] == "Test transcription"
        mock_file.assert_called_once_with("/fake/output.json", 'w')
        # Verify JSON was written
        handle = mock_file()
        written_content = ''.join(call.args[0] for call in handle.write.call_args_list)
        written_data = json.loads(written_content)
        assert written_data["text"] == "Test transcription"


class TestInputValidation:
    """Test input validation - PY-I1 to PY-I4"""
    
    @patch('os.path.exists')
    def test_process_file_missing_input(self, mock_exists):
        """PY-I1: process_file() with missing input file raises FileNotFoundError"""
        mock_exists.return_value = False
        
        with pytest.raises(FileNotFoundError, match="Input file not found"):
            main.process_file("/nonexistent/file.wav")
    
    @patch('app.main.install_requirements')
    def test_main_no_args_shows_usage(self, mock_install):
        """PY-I2: main() with no args or env vars shows usage message and returns 1"""
        with patch.dict(os.environ, {}, clear=True):
            with patch('sys.argv', ['main.py']):
                result = main.main()
                
                assert result == 1
    
    @patch('app.main.install_requirements')
    @patch('app.main.process_file')
    def test_main_with_env_var(self, mock_process, mock_install):
        """PY-I3: main() with valid INPUT_FILE env var processes file"""
        mock_process.return_value = {"text": "success"}
        
        with patch.dict(os.environ, {'INPUT_FILE': '/fake/input.wav'}):
            with patch('sys.argv', ['main.py']):
                result = main.main()
                
                assert result == 0
                mock_process.assert_called_once_with('/fake/input.wav', None)
    
    @patch('app.main.install_requirements')
    @patch('app.main.process_file')
    def test_main_with_command_args(self, mock_process, mock_install):
        """PY-I4: main() with command line args processes file"""
        mock_process.return_value = {"text": "success"}
        
        with patch.dict(os.environ, {}, clear=True):
            with patch('sys.argv', ['main.py', '/fake/input.wav']):
                result = main.main()
                
                assert result == 0
                mock_process.assert_called_once_with('/fake/input.wav', None)


class TestErrorHandling:
    """Test error handling - PY-E1 to PY-E3"""
    
    def test_transcribe_audio_corrupted_file(self):
        """PY-E1: transcribe_audio() with corrupted audio raises graceful error"""
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.side_effect = Exception("Corrupted audio file")
        
        with patch.dict('sys.modules', {'whisper': mock_whisper}):
            with pytest.raises(Exception, match="Corrupted audio file"):
                main.transcribe_audio("/fake/corrupted.wav")
    
    @patch('app.main.transcribe_audio')
    @patch('os.path.exists')
    @patch('builtins.open', side_effect=IOError("Permission denied"))
    def test_process_file_unreadable_output(self, mock_file, mock_exists, mock_transcribe):
        """PY-E2: process_file() with unreadable output path handles error gracefully"""
        mock_exists.return_value = True
        mock_transcribe.return_value = {"text": "test"}
        
        with pytest.raises(IOError, match="Permission denied"):
            main.process_file("/fake/input.wav", "/readonly/output.json")
    
    @patch('app.main.install_requirements')
    @patch('app.main.process_file', side_effect=Exception("General error"))
    def test_main_general_exception(self, mock_process, mock_install):
        """PY-E3: main() with general exception returns 1"""
        with patch.dict(os.environ, {'INPUT_FILE': '/fake/input.wav'}):
            with patch('sys.argv', ['main.py']):
                result = main.main()
                
                assert result == 1


class TestFileOperations:
    """Test file operations - PY-F1 to PY-F3"""
    
    def test_output_json_format(self):
        """PY-F1: Output JSON contains expected keys (text, segments, language)"""
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Sample text",
            "segments": [{"start": 0, "end": 1, "text": "Sample"}],
            "language": "en"
        }
        
        with patch.dict('sys.modules', {'whisper': mock_whisper}):
            result = main.transcribe_audio("/fake/audio.wav")
            
            # Check all required keys are present
            assert "text" in result
            assert "segments" in result
            assert "language" in result
            assert isinstance(result["text"], str)
            assert isinstance(result["segments"], list)
            assert isinstance(result["language"], str)
    
    def test_various_audio_formats(self):
        """PY-F2: Handles various audio formats (WAV, MP3, M4A, etc.)"""
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Format test",
            "segments": [],
            "language": "en"
        }
        
        with patch.dict('sys.modules', {'whisper': mock_whisper}):
            formats = ["/fake/audio.wav", "/fake/audio.mp3", "/fake/audio.m4a", "/fake/audio.flac"]
            
            for audio_file in formats:
                result = main.transcribe_audio(audio_file)
                assert result["text"] == "Format test"
                mock_model.transcribe.assert_called_with(audio_file)
    
    def test_large_audio_files(self):
        """PY-F3: Large audio files processed without memory issues"""
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        # Simulate a large file result
        mock_model.transcribe.return_value = {
            "text": "Large file content " * 1000,  # Simulate large transcript
            "segments": [{"start": i, "end": i+1, "text": f"segment {i}"} for i in range(100)],
            "language": "en"
        }
        
        with patch.dict('sys.modules', {'whisper': mock_whisper}):
            result = main.transcribe_audio("/fake/large_audio.wav")
            
            assert len(result["text"]) > 1000
            assert len(result["segments"]) == 100


class TestEnvironment:
    """Test environment behavior - PY-ENV1 to PY-ENV3"""
    
    def test_auto_install_dependencies(self):
        """PY-ENV1: Script works without pre-installed dependencies"""
        with patch('app.main.os.system') as mock_system:
            # Test that pip install is called when modules are missing
            original_import = __builtins__['__import__']
            
            def mock_import(name, *args, **kwargs):
                if name in ['whisper', 'requests']:
                    raise ImportError(f"No module named '{name}'")
                return original_import(name, *args, **kwargs)
            
            with patch('builtins.__import__', side_effect=mock_import):
                try:
                    main.install_requirements()
                except ImportError:
                    # Expected - imports will still fail in test environment
                    pass
                
            mock_system.assert_called_once_with("pip install openai-whisper requests")
    
    @patch('app.main.install_requirements')
    @patch('app.main.process_file')
    def test_env_vars_precedence(self, mock_process, mock_install):
        """PY-ENV2: Environment variables take precedence over command args"""
        mock_process.return_value = {"text": "success"}
        
        # Set both env var and command line args
        with patch.dict(os.environ, {'INPUT_FILE': '/env/file.wav'}):
            with patch('sys.argv', ['main.py', '/cmd/file.wav']):
                result = main.main()
                
                assert result == 0
                # Should use env var, not command line arg
                mock_process.assert_called_once_with('/env/file.wav', None)
    
    def test_script_executable(self):
        """PY-ENV3: Script executable directly from command line"""
        # Test that main.py has proper shebang and can be executed
        script_path = Path(__file__).parent.parent / 'app' / 'main.py'
        
        # Check shebang exists
        with open(script_path, 'r') as f:
            first_line = f.readline().strip()
            assert first_line.startswith('#!')
            assert 'python' in first_line


# Integration test to verify the script can actually run
class TestIntegration:
    """Integration tests using subprocess"""
    
    def test_script_shows_usage(self):
        """Test that script shows usage when run without arguments"""
        script_path = Path(__file__).parent.parent / 'app' / 'main.py'
        
        # Run the script without arguments
        result = subprocess.run([sys.executable, str(script_path)], 
                              capture_output=True, text=True)
        
        assert result.returncode == 1
        assert "Usage:" in result.stdout
    
    def test_script_handles_missing_file(self):
        """Test that script handles missing input file gracefully"""
        script_path = Path(__file__).parent.parent / 'app' / 'main.py'
        
        # Run the script with non-existent file
        result = subprocess.run([sys.executable, str(script_path), '/nonexistent/file.wav'], 
                              capture_output=True, text=True)
        
        assert result.returncode == 1
        assert "Error:" in result.stdout


if __name__ == "__main__":
    # Run tests if script is called directly
    pytest.main([__file__, "-v"]) 