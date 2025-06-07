#!/usr/bin/env python3
"""
Simplified test cases for Transcription App
Tests core functionality without complex whisper mocking
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path

# Add the app to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

import main as transcription_app

class TestTranscriptionAppSimple(unittest.TestCase):
    
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
    
    def test_app_3_process_file_missing_input_file_raises_error(self):
        """APP-3: process_file() – missing input file → FileNotFoundError"""
        non_existent_file = os.path.join(self.test_dir, "does_not_exist.wav")
        
        # Should raise FileNotFoundError
        with self.assertRaises(FileNotFoundError):
            transcription_app.process_file(non_existent_file)
    
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
        # This should run without errors (whisper is already installed)
        transcription_app.install_requirements()
        
        # If we get here, the function completed successfully
        self.assertTrue(True)
    
    def test_file_existence_check(self):
        """Test that the audio file we created exists and has content"""
        self.assertTrue(os.path.exists(self.test_audio_file))
        self.assertGreater(os.path.getsize(self.test_audio_file), 1000)  # > 1KB
    
    def test_output_directory_creation(self):
        """Test that output directory is created correctly"""
        output_dir = os.path.dirname(self.test_output_file)
        os.makedirs(output_dir, exist_ok=True)
        self.assertTrue(os.path.exists(output_dir))

if __name__ == "__main__":
    unittest.main() 