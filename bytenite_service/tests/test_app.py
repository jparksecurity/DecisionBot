#!/usr/bin/env python3
"""
Test cases for Transcription App
"""

import os
import sys
import json
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add the app to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

import main as transcription_app

class TestTranscriptionApp(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_dir = tempfile.mkdtemp()
        self.test_audio_file = os.path.join(self.test_dir, "test_audio.wav")
        self.test_output_file = os.path.join(self.test_dir, "output.json")
        
        # Create a dummy audio file
        with open(self.test_audio_file, 'wb') as f:
            f.write(b"fake audio data" * 100)  # Make it larger than 1KB
    
    def tearDown(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.test_dir)
    
    @patch('builtins.__import__')
    def test_app_1_transcribe_audio_valid_wav_returns_transcript(self, mock_import):
        """APP-1: transcribe_audio() – valid WAV file → returns transcript"""
        # Mock whisper module
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Hello world",
            "segments": [{"start": 0, "end": 2, "text": "Hello world"}],
            "language": "en"
        }
        
        def side_effect(name, *args, **kwargs):
            if name == 'whisper':
                return mock_whisper
            return __import__(name, *args, **kwargs)
        
        mock_import.side_effect = side_effect
        
        # Call function
        result = transcription_app.transcribe_audio(self.test_audio_file)
        
        # Verify result structure
        self.assertIsInstance(result, dict)
        self.assertIn("text", result)
        self.assertIn("segments", result)
        self.assertIn("language", result)
        self.assertEqual(result["text"], "Hello world")
        self.assertEqual(result["language"], "en")
    
    @patch('builtins.__import__')
    def test_app_2_process_file_valid_audio_returns_result(self, mock_import):
        """APP-2: process_file() – valid audio → transcription result"""
        # Mock whisper module
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Test transcription",
            "segments": [],
            "language": "en"
        }
        
        def side_effect(name, *args, **kwargs):
            if name == 'whisper':
                return mock_whisper
            return __import__(name, *args, **kwargs)
        
        mock_import.side_effect = side_effect
        
        # Call function
        result = transcription_app.process_file(self.test_audio_file)
        
        # Verify result
        self.assertIsInstance(result, dict)
        self.assertEqual(result["text"], "Test transcription")
    
    def test_app_3_process_file_missing_input_file_raises_error(self):
        """APP-3: process_file() – missing input file → FileNotFoundError"""
        non_existent_file = os.path.join(self.test_dir, "does_not_exist.wav")
        
        # Should raise FileNotFoundError
        with self.assertRaises(FileNotFoundError):
            transcription_app.process_file(non_existent_file)
    
    @patch('builtins.__import__')
    def test_app_4_main_valid_input_file_env_var_success(self, mock_import):
        """APP-4: main() – valid INPUT_FILE env var → processes file"""
        # Mock whisper module
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Environment test",
            "segments": [],
            "language": "en"
        }
        
        def side_effect(name, *args, **kwargs):
            if name == 'whisper':
                return mock_whisper
            return __import__(name, *args, **kwargs)
        
        mock_import.side_effect = side_effect
        
        # Set environment variable
        os.environ["INPUT_FILE"] = self.test_audio_file
        os.environ["OUTPUT_FILE"] = self.test_output_file
        
        try:
            # Run main function
            result = transcription_app.main()
            
            # Should succeed
            self.assertEqual(result, 0)
            
            # Check output file was created
            self.assertTrue(os.path.exists(self.test_output_file))
            
            # Verify output content
            with open(self.test_output_file, 'r') as f:
                output_data = json.load(f)
            self.assertEqual(output_data["text"], "Environment test")
        
        finally:
            # Clean up environment
            if "INPUT_FILE" in os.environ:
                del os.environ["INPUT_FILE"]
            if "OUTPUT_FILE" in os.environ:
                del os.environ["OUTPUT_FILE"]
    
    @patch('builtins.__import__')
    def test_app_5_transcribe_audio_corrupted_audio_graceful_error(self, mock_import):
        """APP-5: transcribe_audio() – corrupted audio → graceful error"""
        # Mock whisper module
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.side_effect = Exception("Audio file corrupted")
        
        def side_effect(name, *args, **kwargs):
            if name == 'whisper':
                return mock_whisper
            return __import__(name, *args, **kwargs)
        
        mock_import.side_effect = side_effect
        
        # Should raise an exception with a clear message
        with self.assertRaises(Exception) as context:
            transcription_app.transcribe_audio(self.test_audio_file)
        
        self.assertIn("Audio file corrupted", str(context.exception))
    
    @patch('builtins.__import__')
    def test_main_with_command_line_args(self, mock_import):
        """Test main function with command line arguments"""
        # Mock whisper module
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "Command line test",
            "segments": [],
            "language": "en"
        }
        
        def side_effect(name, *args, **kwargs):
            if name == 'whisper':
                return mock_whisper
            return __import__(name, *args, **kwargs)
        
        mock_import.side_effect = side_effect
        
        # Mock command line arguments
        original_argv = sys.argv
        sys.argv = ["main.py", self.test_audio_file, self.test_output_file]
        
        try:
            # Run main function
            result = transcription_app.main()
            
            # Should succeed
            self.assertEqual(result, 0)
            
            # Check output file was created
            self.assertTrue(os.path.exists(self.test_output_file))
        
        finally:
            # Restore original argv
            sys.argv = original_argv
    
    def test_main_no_args_shows_usage(self):
        """Test main function with no arguments shows usage"""
        # Mock command line arguments (only script name)
        original_argv = sys.argv
        sys.argv = ["main.py"]
        
        try:
            # Run main function
            result = transcription_app.main()
            
            # Should return error code
            self.assertEqual(result, 1)
        
        finally:
            # Restore original argv
            sys.argv = original_argv
    
    def test_install_requirements_function(self):
        """Test that install_requirements function works"""
        # This should run without errors
        transcription_app.install_requirements()
        
        # If we get here, the function completed successfully
        self.assertTrue(True)
    
    @patch('builtins.__import__')
    def test_output_json_format(self, mock_import):
        """Test that output JSON has the correct format"""
        # Mock whisper module
        mock_whisper = MagicMock()
        mock_model = MagicMock()
        mock_whisper.load_model.return_value = mock_model
        mock_model.transcribe.return_value = {
            "text": "JSON format test",
            "segments": [{"start": 0, "end": 3, "text": "JSON format test"}],
            "language": "en"
        }
        
        def side_effect(name, *args, **kwargs):
            if name == 'whisper':
                return mock_whisper
            return __import__(name, *args, **kwargs)
        
        mock_import.side_effect = side_effect
        
        # Process file with output
        transcription_app.process_file(self.test_audio_file, self.test_output_file)
        
        # Verify output file format
        with open(self.test_output_file, 'r') as f:
            output_data = json.load(f)
        
        # Check all required keys are present
        required_keys = ["text", "segments", "language"]
        for key in required_keys:
            self.assertIn(key, output_data)
        
        # Verify data types
        self.assertIsInstance(output_data["text"], str)
        self.assertIsInstance(output_data["segments"], list)
        self.assertIsInstance(output_data["language"], str)

if __name__ == "__main__":
    unittest.main() 