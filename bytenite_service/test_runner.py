#!/usr/bin/env python3
"""
Simple test runner for ByteNite service components
"""

import os
import sys
import tempfile
import json
from pathlib import Path

def test_directory_partitioner():
    """Test the directory partitioner"""
    print("🧪 Testing Directory Partitioner...")
    
    # Create temporary directories
    with tempfile.TemporaryDirectory() as temp_dir:
        input_dir = Path(temp_dir) / "input"
        chunks_dir = Path(temp_dir) / "chunks"
        
        input_dir.mkdir()
        
        # Create some fake audio files
        (input_dir / "meeting1.wav").touch()
        (input_dir / "meeting2.mp3").touch()
        (input_dir / "presentation.m4a").touch()
        
        # Run the partitioner
        partitioner_path = Path(__file__).parent / "directory-partitioner" / "app" / "main.py"
        cmd = f"cd {partitioner_path.parent} && python main.py {input_dir} {chunks_dir}"
        
        result = os.system(cmd)
        
        if result == 0 and chunks_dir.exists():
            chunk_files = list(chunks_dir.glob("*.txt"))
            print(f"✅ Directory Partitioner: Created {len(chunk_files)} chunks")
            return True
        else:
            print("❌ Directory Partitioner: Failed")
            return False

def test_transcription_service():
    """Test the transcription service (without actual audio)"""
    print("🧪 Testing Transcription Service...")
    
    # This would normally test with real audio, but we'll just check the script syntax
    transcription_path = Path(__file__).parent / "transcription-service" / "app" / "main.py"
    
    # Just check if the file can be imported/parsed
    try:
        with open(transcription_path) as f:
            code = f.read()
        
        # Basic syntax check
        compile(code, str(transcription_path), 'exec')
        print("✅ Transcription Service: Syntax check passed")
        return True
    except Exception as e:
        print(f"❌ Transcription Service: {e}")
        return False

def test_decision_extractor():
    """Test the decision extractor assembler"""
    print("🧪 Testing Decision Extractor Assembler...")
    
    # Create temporary directories with fake transcripts
    with tempfile.TemporaryDirectory() as temp_dir:
        input_dir = Path(temp_dir) / "input"
        input_dir.mkdir()
        
        # Create fake transcript files
        transcript1 = {
            "text": "We decided to implement the new feature by next Friday. Let's schedule a follow-up meeting.",
            "language": "en"
        }
        
        transcript2 = {
            "text": "I agree with that decision. We should also plan to review the design next week.",
            "language": "en"
        }
        
        with open(input_dir / "user1.json", 'w') as f:
            json.dump(transcript1, f)
        
        with open(input_dir / "user2.json", 'w') as f:
            json.dump(transcript2, f)
        
        output_file = Path(temp_dir) / "decisions.json"
        
        # Run the assembler (without GMI_API_KEY, so it will use regex fallback)
        assembler_path = Path(__file__).parent / "decision-extractor-assembler" / "app" / "main.py"
        cmd = f"cd {assembler_path.parent} && python main.py {input_dir} {output_file}"
        
        result = os.system(cmd)
        
        if result == 0 and output_file.exists():
            with open(output_file) as f:
                decisions = json.load(f)
            print(f"✅ Decision Extractor: Found {len(decisions.get('decisions', []))} decisions")
            return True
        else:
            print("❌ Decision Extractor: Failed")
            return False

def main():
    """Run all tests"""
    print("🚀 Running ByteNite Service Component Tests\n")
    
    tests = [
        test_directory_partitioner,
        test_transcription_service,
        test_decision_extractor
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    exit(main()) 