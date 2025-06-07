#!/usr/bin/env python3
"""
Directory Partitioner for ByteNite
Creates a chunk for each audio file in the input directory
"""

import os
import sys
import json
from pathlib import Path

def create_chunks_for_directory(input_dir, chunks_dir):
    """
    Create chunks for each audio file in the input directory.
    Each chunk contains the path to one audio file.
    """
    input_path = Path(input_dir)
    chunks_path = Path(chunks_dir)
    
    # Ensure chunks directory exists
    chunks_path.mkdir(parents=True, exist_ok=True)
    
    # Supported audio file extensions
    audio_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'}
    
    # Find all audio files in the input directory
    audio_files = []
    if input_path.exists() and input_path.is_dir():
        for file_path in input_path.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                audio_files.append(file_path)
    
    print(f"Found {len(audio_files)} audio files in {input_dir}")
    
    # Create a chunk file for each audio file
    for i, audio_file in enumerate(audio_files):
        chunk_filename = f"chunk_{i:04d}.json"
        chunk_path = chunks_path / chunk_filename
        
        # Create chunk metadata
        chunk_data = {
            "file_path": str(audio_file),
            "filename": audio_file.name,
            "user_id": audio_file.stem,  # Assuming filename is userId.wav
            "file_size": audio_file.stat().st_size if audio_file.exists() else 0
        }
        
        # Write chunk file
        with open(chunk_path, 'w') as f:
            json.dump(chunk_data, f, indent=2)
        
        print(f"Created chunk: {chunk_filename} for {audio_file.name}")
    
    return len(audio_files)

def main():
    """Main entry point for ByteNite partitioner"""
    # Get input and output directories from environment variables
    input_dir = os.getenv("INPUT_DIR", "/input")
    chunks_dir = os.getenv("CHUNKS_DIR", "/chunks")
    
    # Also support command line arguments for testing
    if len(sys.argv) >= 2:
        input_dir = sys.argv[1]
    if len(sys.argv) >= 3:
        chunks_dir = sys.argv[2]
    
    print(f"Directory Partitioner starting...")
    print(f"Input directory: {input_dir}")
    print(f"Chunks directory: {chunks_dir}")
    
    try:
        chunk_count = create_chunks_for_directory(input_dir, chunks_dir)
        print(f"✅ Successfully created {chunk_count} chunks")
        return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    exit(main()) 