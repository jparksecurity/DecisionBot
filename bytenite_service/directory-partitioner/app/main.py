#!/usr/bin/env python3
"""
Directory Partitioner for ByteNite
Reads a directory of audio files and creates a separate task for each file
"""

import os
import sys
import json
from pathlib import Path

def create_chunks(input_dir, chunks_dir):
    """
    Create chunks from directory of audio files.
    Each file becomes a separate chunk for processing.
    """
    input_path = Path(input_dir)
    chunks_path = Path(chunks_dir)
    
    if not input_path.exists():
        print(f"Warning: Input directory {input_dir} does not exist")
        return 0
    
    # Ensure chunks directory exists
    chunks_path.mkdir(parents=True, exist_ok=True)
    
    # Common audio file extensions
    audio_extensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac']
    
    # Find all audio files
    audio_files = []
    for ext in audio_extensions:
        audio_files.extend(input_path.glob(f"*{ext}"))
        audio_files.extend(input_path.glob(f"*{ext.upper()}"))
    
    print(f"Found {len(audio_files)} audio files to partition")
    
    chunk_count = 0
    for audio_file in audio_files:
        # Create a chunk file with the path to the audio file
        chunk_filename = f"chunk_{chunk_count:04d}.txt"
        chunk_path = chunks_path / chunk_filename
        
        # Write the full path to the audio file in the chunk
        with open(chunk_path, 'w') as f:
            f.write(str(audio_file.absolute()))
        
        print(f"Created chunk {chunk_filename} for {audio_file.name}")
        chunk_count += 1
    
    return chunk_count

def main():
    """Main entry point for ByteNite partitioner"""
    # Get input and output from environment variables
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
        chunk_count = create_chunks(input_dir, chunks_dir)
        print(f"✅ Successfully created {chunk_count} chunks")
        return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
