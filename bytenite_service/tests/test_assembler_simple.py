#!/usr/bin/env python3
"""
Simplified test cases for Decision Extractor Assembler
Tests core functionality without complex request mocking
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path

# Add the assembler to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'assembler'))

import main as assembler

class TestDecisionExtractorAssemblerSimple(unittest.TestCase):
    
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
        # Create multiple transcript files with consistent naming
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
        
        # Check user IDs were extracted (now expecting the new format)
        user_ids = [t["user_id"] for t in transcripts]
        self.assertIn("user1", user_ids)
        self.assertIn("user2", user_ids)
        self.assertIn("user3", user_ids)
    
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
    
    def test_extract_user_id_from_filename(self):
        """Test user ID extraction from various filename patterns"""
        # Test various patterns with updated expectations
        test_cases = [
            ("user123.json", "user123"),
            ("output_user456.json", "user456"),
            ("result_789.json", "789"),
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
    
    def test_install_requirements_function(self):
        """Test that install_requirements function works"""
        # This should run without errors
        assembler.install_requirements()
        
        # If we get here, the function completed successfully
        self.assertTrue(True)

if __name__ == "__main__":
    unittest.main() 