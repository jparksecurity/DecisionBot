#!/usr/bin/env python3
"""
Simple transcription service for ByteNite
Processes audio files using OpenAI Whisper
"""

import os
import sys
import json
import tempfile
from pathlib import Path

def install_requirements():
    """Install required packages if not available"""
    try:
        import whisper
        import requests
    except ImportError:
        print("Installing required packages...")
        os.system("pip install openai-whisper requests")
        import whisper
        import requests

def transcribe_audio(audio_file_path):
    """Transcribe audio file using Whisper"""
    # Import whisper locally so it can be mocked in tests
    import whisper
    
    print(f"Loading Whisper model...")
    model = whisper.load_model("base")
    
    print(f"Transcribing audio file: {audio_file_path}")
    result = model.transcribe(audio_file_path)
    
    return {
        "text": result["text"],
        "segments": result.get("segments", []),
        "language": result.get("language", "unknown")
    }

def process_file(input_path, output_path=None):
    """Process a single audio file"""
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    # Transcribe the audio
    result = transcribe_audio(input_path)
    
    # Save or return result
    if output_path:
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Transcription saved to: {output_path}")
    else:
        print("Transcription:")
        print(result["text"])
    
    return result

def main():
    """Main entry point for ByteNite"""
    # Install requirements if needed
    install_requirements()
    
    # For ByteNite apps, read from TASK_DIR/data.bin and output to TASK_RESULTS_DIR
    task_dir = os.getenv("TASK_DIR")
    task_results_dir = os.getenv("TASK_RESULTS_DIR")
    
    if task_dir and task_results_dir:
        # ByteNite mode - read from chunk and output to results directory
        input_file = os.path.join(task_dir, "data.bin")
        output_file = os.path.join(task_results_dir, "transcript.json")
    else:
        # Standalone mode - use environment variables or command line
        input_file = os.getenv("INPUT_FILE") or (sys.argv[1] if len(sys.argv) > 1 else None)
        output_file = os.getenv("OUTPUT_FILE") or (sys.argv[2] if len(sys.argv) > 2 else None)
    
    if not input_file:
        print("Usage: python main.py <input_audio_file> [output_json_file]")
        print("Or set INPUT_FILE environment variable")
        return 1
    
    try:
        result = process_file(input_file, output_file)
        print("✅ Transcription completed successfully!")
        return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())