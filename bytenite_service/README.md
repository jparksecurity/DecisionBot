# ByteNite Service Components

This directory contains the restored ByteNite service components that were previously removed. All components have been recreated using the ByteNite CLI for better compatibility and integration.

## Components

### 1. Transcription Service (`transcription-service/`)

An app that processes audio files using OpenAI Whisper for speech-to-text conversion.

**Features:**
- Supports multiple audio formats (WAV, MP3, M4A, FLAC, OGG, AAC)
- Uses OpenAI Whisper model for accurate transcription
- Outputs structured JSON with text, segments, and language detection
- Auto-installs dependencies if not available

**Usage:**
```bash
cd transcription-service/app
python main.py <input_audio_file> [output_json_file]
```

**Environment Variables:**
- `INPUT_FILE`: Path to audio file to transcribe
- `OUTPUT_FILE`: Path for output JSON file

### 2. Decision Extractor Assembler (`decision-extractor-assembler/`)

An assembling engine that merges transcripts and extracts decisions using GMI Cloud or regex fallback.

**Features:**
- Merges multiple transcript JSON files
- Extracts speaker information from filenames
- Uses GMI Cloud API for intelligent decision extraction
- Falls back to regex patterns if API unavailable
- Handles multiple file naming patterns

**Usage:**
```bash
cd decision-extractor-assembler/app
python main.py <input_directory> <output_file>
```

**Environment Variables:**
- `GMI_API_KEY`: API key for GMI Cloud service
- `INPUT_DIR`: Directory containing transcript JSON files
- `OUTPUT_FILE`: Path for output decisions JSON

### 3. Directory Partitioner (`directory-partitioner/`)

A partitioning engine that reads a directory of audio files and creates separate tasks for each file.

**Features:**
- Scans directory for audio files
- Creates individual chunks for parallel processing
- Supports common audio file formats
- Simple text-based chunk format

**Usage:**
```bash
cd directory-partitioner/app
python main.py <input_directory> <chunks_directory>
```

**Environment Variables:**
- `INPUT_DIR`: Directory containing audio files
- `CHUNKS_DIR`: Directory to write chunk files

## Testing

Run the test suite to verify all components:

```bash
cd bytenite_service
python test_runner.py
```

The test runner will:
- Test directory partitioner with fake audio files
- Verify transcription service syntax
- Test decision extractor with sample transcripts

## ByteNite CLI Integration

All components were created using the ByteNite CLI:

```bash
# Apps
bytenite app new transcription-service

# Engines
bytenite engine new decision-extractor-assembler  # Type: assembler
bytenite engine new directory-partitioner         # Type: partitioner
```

## Dependencies

Each component includes its own `requirements.txt`:

- **transcription-service**: `openai-whisper`, `requests`
- **decision-extractor-assembler**: `requests`
- **directory-partitioner**: No additional dependencies (uses stdlib)

## Configuration

Each component includes a `manifest.json` with:
- Platform configuration (Docker with Python)
- Resource requirements
- Entry points and descriptions

## Architecture

The components work together in a pipeline:

1. **Directory Partitioner** → Splits audio files into individual tasks
2. **Transcription Service** → Processes each audio file to create transcripts
3. **Decision Extractor Assembler** → Merges transcripts and extracts decisions

This follows the ByteNite pattern of partitioner → app → assembler for scalable processing. 