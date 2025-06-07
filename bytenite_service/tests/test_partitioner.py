#!/usr/bin/env python3
"""
Test cases for Directory Partitioner
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path

# Add the partitioner to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'directory-partitioner'))

import main as partitioner

class TestDirectoryPartitioner(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures with temporary directories"""
        self.test_dir = tempfile.mkdtemp()
        self.input_dir = os.path.join(self.test_dir, "input")
        self.chunks_dir = os.path.join(self.test_dir, "chunks")
        os.makedirs(self.input_dir)
        os.makedirs(self.chunks_dir)
        
    def tearDown(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.test_dir)
    
    def create_dummy_audio_file(self, filename, content="dummy audio data"):
        """Helper to create dummy audio files"""
        filepath = os.path.join(self.input_dir, filename)
        with open(filepath, 'w') as f:
            f.write(content)
        return filepath
    
    def test_part_1_given_input_dir_with_3_files_creates_3_chunks(self):
        """PART-1: Given input dir with 3 files, creates 3 chunks"""
        # Create 3 audio files
        self.create_dummy_audio_file("user1.wav")
        self.create_dummy_audio_file("user2.mp3")
        self.create_dummy_audio_file("user3.m4a")
        
        # Run partitioner
        chunk_count = partitioner.create_chunks_for_directory(self.input_dir, self.chunks_dir)
        
        # Verify 3 chunks were created
        self.assertEqual(chunk_count, 3)
        
        # Check that chunk files exist
        chunk_files = list(Path(self.chunks_dir).glob("chunk_*.json"))
        self.assertEqual(len(chunk_files), 3)
        
        # Verify chunk content
        for chunk_file in chunk_files:
            with open(chunk_file, 'r') as f:
                chunk_data = json.load(f)
            
            self.assertIn("file_path", chunk_data)
            self.assertIn("filename", chunk_data)
            self.assertIn("user_id", chunk_data)
            self.assertIn("file_size", chunk_data)
    
    def test_part_2_given_empty_input_dir_creates_0_chunks(self):
        """PART-2: Given empty input dir, creates 0 chunks"""
        # Input dir is already empty from setUp
        
        # Run partitioner
        chunk_count = partitioner.create_chunks_for_directory(self.input_dir, self.chunks_dir)
        
        # Verify 0 chunks were created
        self.assertEqual(chunk_count, 0)
        
        # Check that no chunk files exist
        chunk_files = list(Path(self.chunks_dir).glob("chunk_*.json"))
        self.assertEqual(len(chunk_files), 0)
    
    def test_part_3_handles_non_existent_input_dir_gracefully(self):
        """PART-3: Handles non-existent input dir gracefully"""
        non_existent_dir = os.path.join(self.test_dir, "does_not_exist")
        
        # Run partitioner with non-existent directory
        chunk_count = partitioner.create_chunks_for_directory(non_existent_dir, self.chunks_dir)
        
        # Should handle gracefully and return 0
        self.assertEqual(chunk_count, 0)
    
    def test_filters_non_audio_files(self):
        """Test that non-audio files are ignored"""
        # Create mixed files
        self.create_dummy_audio_file("user1.wav")
        self.create_dummy_audio_file("readme.txt")
        self.create_dummy_audio_file("user2.mp3")
        self.create_dummy_audio_file("config.json")
        
        # Run partitioner
        chunk_count = partitioner.create_chunks_for_directory(self.input_dir, self.chunks_dir)
        
        # Should only process the 2 audio files
        self.assertEqual(chunk_count, 2)
    
    def test_main_function_with_env_vars(self):
        """Test main function using environment variables"""
        # Create test audio file
        self.create_dummy_audio_file("test.wav")
        
        # Set environment variables
        os.environ["INPUT_DIR"] = self.input_dir
        os.environ["CHUNKS_DIR"] = self.chunks_dir
        
        # Run main function
        result = partitioner.main()
        
        # Should succeed
        self.assertEqual(result, 0)
        
        # Check chunks were created
        chunk_files = list(Path(self.chunks_dir).glob("chunk_*.json"))
        self.assertEqual(len(chunk_files), 1)
        
        # Clean up environment
        del os.environ["INPUT_DIR"]
        del os.environ["CHUNKS_DIR"]
    
    def test_main_function_with_command_line_args(self):
        """Test main function using command line arguments"""
        # Create test audio file
        self.create_dummy_audio_file("test.wav")
        
        # Mock command line arguments
        original_argv = sys.argv
        sys.argv = ["main.py", self.input_dir, self.chunks_dir]
        
        try:
            # Run main function
            result = partitioner.main()
            
            # Should succeed
            self.assertEqual(result, 0)
            
            # Check chunks were created
            chunk_files = list(Path(self.chunks_dir).glob("chunk_*.json"))
            self.assertEqual(len(chunk_files), 1)
        
        finally:
            # Restore original argv
            sys.argv = original_argv
    
    def test_chunk_data_format(self):
        """Test that chunk data has the correct format"""
        # Create test audio file
        audio_file = self.create_dummy_audio_file("user123.wav")
        
        # Run partitioner
        partitioner.create_chunks_for_directory(self.input_dir, self.chunks_dir)
        
        # Read chunk data
        chunk_files = list(Path(self.chunks_dir).glob("chunk_*.json"))
        self.assertEqual(len(chunk_files), 1)
        
        with open(chunk_files[0], 'r') as f:
            chunk_data = json.load(f)
        
        # Verify all required fields
        self.assertEqual(chunk_data["filename"], "user123.wav")
        self.assertEqual(chunk_data["user_id"], "user123")
        self.assertTrue(chunk_data["file_path"].endswith("user123.wav"))
        self.assertIsInstance(chunk_data["file_size"], int)
        self.assertGreater(chunk_data["file_size"], 0)

if __name__ == "__main__":
    unittest.main() 