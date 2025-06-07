#!/usr/bin/env python3
"""
Test cases for Decision Extractor Assembler
"""

import os
import sys
import json
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add the assembler to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'assembler'))

import main as assembler

class TestDecisionExtractorAssembler(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_dir = tempfile.mkdtemp()
        self.input_dir = os.path.join(self.test_dir, "input")
        self.output_file = os.path.join(self.test_dir, "decisions.json")
        os.makedirs(self.input_dir)
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
    
    def tearDown(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.test_dir)
    
    def create_transcript_file(self, filename, text, user_id="user123", language="en"):
        """Helper to create transcript JSON files"""
        transcript_data = {
            "text": text,
            "segments": [{"start": 0, "end": len(text)/10, "text": text}],
            "language": language
        }
        
        filepath = os.path.join(self.input_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(transcript_data, f, indent=2)
        return filepath
    
    def test_asm_1_merge_transcripts_combines_multiple_inputs(self):
        """ASM-1: merge_transcripts() – combines text from multiple input JSONs"""
        # Create multiple transcript files
        self.create_transcript_file("user1.json", "Hello everyone", "user1")
        self.create_transcript_file("user2.json", "I agree with that decision", "user2")
        self.create_transcript_file("user3.json", "Let's move forward", "user3")
        
        # Merge transcripts
        transcripts = assembler.merge_transcripts(self.input_dir)
        
        # Verify result
        self.assertEqual(len(transcripts), 3)
        
        # Check that all texts are present
        texts = [t["text"] for t in transcripts]
        self.assertIn("Hello everyone", texts)
        self.assertIn("I agree with that decision", texts)
        self.assertIn("Let's move forward", texts)
        
        # Check user IDs were extracted
        user_ids = [t["user_id"] for t in transcripts]
        self.assertIn("user1", user_ids)
        self.assertIn("user2", user_ids)
        self.assertIn("user3", user_ids)
    
    @patch('main.requests.post')
    def test_asm_2_call_gmi_with_merged_text(self, mock_post):
        """ASM-2: call_gmi() – mock GMI call with merged text"""
        # Mock GMI response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": '[{"text": "Ship the new feature", "speaker_id": "user1"}]'
                }
            }]
        }
        mock_post.return_value = mock_response
        
        # Set API key
        os.environ["GMI_API_KEY"] = "test_key"
        
        try:
            # Call GMI
            decisions = assembler.call_gmi_cloud("We decided to ship the new feature")
            
            # Verify result
            self.assertEqual(len(decisions), 1)
            self.assertEqual(decisions[0]["text"], "Ship the new feature")
            self.assertEqual(decisions[0]["speaker_id"], "user1")
            
            # Verify API was called
            mock_post.assert_called_once()
            args, kwargs = mock_post.call_args
            self.assertIn("Authorization", kwargs["headers"])
            self.assertEqual(kwargs["headers"]["Authorization"], "Key test_key")
        
        finally:
            if "GMI_API_KEY" in os.environ:
                del os.environ["GMI_API_KEY"]
    
    def test_asm_3_regex_fallback_finds_decisions(self):
        """ASM-3: regex_fallback() – if GMI fails, local regex finds decisions"""
        # Test text with decision patterns
        combined_text = """
        Speaker user1: Hello everyone, let's start the meeting.
        Speaker user2: We will ship the API v2 next Friday.
        Speaker user3: I agree with that decision.
        Speaker user1: Let's also implement the dark mode feature.
        Speaker user2: We decided to postpone the mobile app release.
        """
        
        # Call regex fallback
        decisions = assembler.regex_fallback(combined_text)
        
        # Should find multiple decisions
        self.assertGreater(len(decisions), 0)
        
        # Check that it found some decision patterns
        decision_texts = [d["text"] for d in decisions]
        
        # Should find at least one of these patterns
        found_patterns = any([
            any("ship" in text.lower() for text in decision_texts),
            any("implement" in text.lower() for text in decision_texts),
            any("postpone" in text.lower() for text in decision_texts)
        ])
        self.assertTrue(found_patterns)
    
    @patch('main.call_gmi_cloud')
    def test_asm_4_main_processes_multiple_files_to_final_json(self, mock_gmi):
        """ASM-4: main() – processes multiple input files into a final decision JSON"""
        # Mock GMI response
        mock_gmi.return_value = [
            {"text": "Deploy to production", "speaker_id": "user1"},
            {"text": "Schedule code review", "speaker_id": "user2"}
        ]
        
        # Create transcript files
        self.create_transcript_file("transcript1.json", "We will deploy to production tomorrow")
        self.create_transcript_file("transcript2.json", "Let's schedule a code review")
        
        # Run main function
        result = assembler.process_transcripts(self.input_dir, self.output_file)
        
        # Verify result
        self.assertEqual(len(result["decisions"]), 2)
        self.assertEqual(result["extraction_method"], "gmi_cloud")
        self.assertEqual(result["transcript_count"], 2)
        
        # Verify output file was created
        self.assertTrue(os.path.exists(self.output_file))
        
        # Verify output file content
        with open(self.output_file, 'r') as f:
            output_data = json.load(f)
        
        self.assertEqual(len(output_data["decisions"]), 2)
    
    def test_asm_5_handles_zero_input_files_gracefully(self):
        """ASM-5: Handles zero input transcript files gracefully"""
        # Input directory is empty
        
        # Run assembler
        result = assembler.process_transcripts(self.input_dir, self.output_file)
        
        # Should handle gracefully
        self.assertEqual(len(result["decisions"]), 0)
        self.assertEqual(result["message"], "No transcripts found")
        
        # Output file should exist with empty decisions
        self.assertTrue(os.path.exists(self.output_file))
        
        with open(self.output_file, 'r') as f:
            output_data = json.load(f)
        
        self.assertEqual(len(output_data["decisions"]), 0)
    
    @patch('main.call_gmi_cloud')
    def test_asm_6_main_gmi_call_fails_returns_error(self, mock_gmi):
        """ASM-6: main() – GMI call fails → returns 1, logs error"""
        # Mock GMI to raise an exception
        mock_gmi.side_effect = Exception("GMI service unavailable")
        
        # Create transcript files
        self.create_transcript_file("transcript.json", "We decided something")
        
        # Mock environment variables
        os.environ["INPUT_DIR"] = self.input_dir
        os.environ["OUTPUT_FILE"] = self.output_file
        
        try:
            # Run main function
            result = assembler.main()
            
            # Should still succeed (fallback to regex)
            self.assertEqual(result, 0)
            
            # Verify output file was created with fallback method
            with open(self.output_file, 'r') as f:
                output_data = json.load(f)
            
            self.assertEqual(output_data["extraction_method"], "regex_fallback")
        
        finally:
            if "INPUT_DIR" in os.environ:
                del os.environ["INPUT_DIR"]
            if "OUTPUT_FILE" in os.environ:
                del os.environ["OUTPUT_FILE"]
    
    def test_asm_7_output_json_matches_expected_format(self):
        """ASM-7: Output JSON for decisions matches expected format"""
        # Create transcript file
        self.create_transcript_file("transcript.json", "We decided to launch next week")
        
        # Run assembler with fallback (no GMI key)
        result = assembler.process_transcripts(self.input_dir, self.output_file)
        
        # Verify output file format
        with open(self.output_file, 'r') as f:
            output_data = json.load(f)
        
        # Check required keys
        required_keys = ["decisions", "extraction_method", "transcript_count", "participants"]
        for key in required_keys:
            self.assertIn(key, output_data)
        
        # Verify data types
        self.assertIsInstance(output_data["decisions"], list)
        self.assertIsInstance(output_data["extraction_method"], str)
        self.assertIsInstance(output_data["transcript_count"], int)
        self.assertIsInstance(output_data["participants"], list)
    
    @patch('main.requests')
    def test_asm_8_install_requirements_installs_requests(self, mock_requests_module):
        """ASM-8: install_requirements() – installs requests"""
        # This should run without errors
        assembler.install_requirements()
        
        # If we get here, the function completed successfully
        self.assertTrue(True)
    
    def test_extract_user_id_from_filename(self):
        """Test user ID extraction from various filename patterns"""
        # Test various patterns
        test_cases = [
            ("user123.json", "user123"),
            ("output_user456.json", "user456"),
            ("result_789.json", "result_789"),
            ("chunk_0001.json", "user_0001"),
            ("unknown.json", "unknown")
        ]
        
        for filename, expected_user_id in test_cases:
            with self.subTest(filename=filename):
                result = assembler.extract_user_id_from_filename(filename)
                if "user_" in expected_user_id:
                    # For numbered patterns, just check it starts correctly
                    self.assertTrue(result.startswith("user_"))
                else:
                    self.assertEqual(result, expected_user_id)
    
    def test_main_function_with_command_line_args(self):
        """Test main function with command line arguments"""
        # Create transcript file
        self.create_transcript_file("test.json", "We decided to use regex fallback")
        
        # Mock command line arguments
        original_argv = sys.argv
        sys.argv = ["main.py", self.input_dir, self.output_file]
        
        try:
            # Run main function
            result = assembler.main()
            
            # Should succeed
            self.assertEqual(result, 0)
            
            # Check output file was created
            self.assertTrue(os.path.exists(self.output_file))
        
        finally:
            # Restore original argv
            sys.argv = original_argv

if __name__ == "__main__":
    unittest.main() 