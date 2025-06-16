# ByteNite Testing Suite

This directory contains testing tools and utilities for ByteNite job management, including pre-generated test audio files, API interaction scripts, and job monitoring utilities.

## Prerequisites

- Node.js (version 20.6.0 or higher, for `--env-file` support)
- macOS with `say` command (only needed for generating new audio files)
- ByteNite API key
- OpenAI API key

## Environment Setup

1. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your API keys:
   ```bash
   BYTENITE_API_KEY=your-bytenite-api-key
   OPENAI_API_KEY=your-openai-api-key
   ```

## Scripts Overview

### 1. Test Audio Files

The `audio-test-data/` directory contains pre-generated test audio files simulating a team meeting with decision discussions. These files are ready to use for ByteNite testing.

**Existing test files:**
- 3 WAV files representing different meeting participants:
  - `user123.wav` - Alice (Project Manager, Samantha voice)
  - `user456.wav` - Bob (Developer, Alex voice)  
  - `user789.wav` - Charlie (Designer, Victoria voice)

**To generate new test files (optional):**
```bash
chmod +x generate-test-audio.sh
./generate-test-audio.sh
```

**Audio Properties:**
- Format: WAV (RIFF, little-endian)
- Sample Rate: 22.05 kHz
- Bit Depth: 16-bit
- Duration: ~14-15 seconds each
- Compatible with OpenAI Whisper transcription

### 2. ByteNite Job Testing (`test-script.js`)

Main test script that creates and runs ByteNite jobs for audio transcription and decision extraction.

**Usage:**
```bash
# Using environment variables directly
BYTENITE_API_KEY=your-api-key OPENAI_API_KEY=your-openai-key node test-script.js

# Using .env file (Node.js 20.6.0+)
node --env-file=.env test-script.js

# For older Node.js versions, use dotenv
npm install dotenv
node -r dotenv/config test-script.js
```

**What it does:**
1. Authenticates with ByteNite API
2. Creates a transcription job
3. Uploads audio files
4. Monitors job progress
5. Retrieves and displays results

### 3. Job Log Retrieval (`get-job-logs.js`)

Utility script to fetch and display logs from a specific ByteNite job.

**Usage:**
```bash
# Using environment variables directly
BYTENITE_API_KEY=your-api-key node get-job-logs.js <job-id>

# Using .env file (Node.js 20.6.0+)
node --env-file=.env get-job-logs.js <job-id>

# For older Node.js versions, use dotenv
node -r dotenv/config get-job-logs.js <job-id>
```

## Meeting Scenario

The generated audio simulates a team meeting where participants discuss and make the following decisions:

1. **Ship API v2 on June 20th** - Discussed by Alice and confirmed by Bob
2. **Upgrade to Node 20** - Proposed by Bob as a prerequisite  
3. **Skip next week's retrospective** - Suggested by Charlie

## Testing Workflow

### Complete End-to-End Test

1. **Use existing test audio files** (already available in `audio-test-data/`)

2. **Run the main test script:**
   ```bash
   # Node.js 20.6.0+
   node --env-file=.env test-script.js
   
   # Older Node.js versions
   node -r dotenv/config test-script.js
   ```

3. **Monitor job logs (if needed):**
   ```bash
   # Node.js 20.6.0+
   node --env-file=.env get-job-logs.js <job-id-from-step-2>
   
   # Older Node.js versions
   node -r dotenv/config get-job-logs.js <job-id-from-step-2>
   ```

### Expected Behavior

When processed by the ByteNite transcription pipeline, these audio files should:

1. Be transcribed accurately by the ByteNite transcription service
2. Have 3 decisions extracted:
   - "Ship API v2 on June 20th"
   - "Upgrade to Node 20"
   - "Skip next week's retrospective"
3. Return structured results via the ByteNite API

## Troubleshooting

### Environment Variables Not Set
If you see errors about missing API keys, ensure your `.env` file exists and contains valid keys:
```bash
cat .env
```

### Audio Generation Issues
- Ensure you're running on macOS with the `say` command available
- Check that the `generate-test-audio.sh` script has execute permissions:
  ```bash
  chmod +x generate-test-audio.sh
  ```

### ByteNite API Issues
- Verify your `BYTENITE_API_KEY` is valid and has appropriate permissions
- Check the job logs using `get-job-logs.js` for detailed error information
- Ensure your `OPENAI_API_KEY` is set correctly for the assembler step

## File Structure

```
bytenite_test/
├── README.md                    # This file
├── .env.example                 # Environment variables template
├── .env                         # Your actual environment variables (not in git)
├── generate-test-audio.sh       # Audio generation script
├── test-script.js              # Main ByteNite job testing script
├── get-job-logs.js             # Job log retrieval utility
└── audio-test-data/            # Generated test audio files
    └── test-meeting-<timestamp>/
        ├── user123.wav         # Alice's audio
        ├── user456.wav         # Bob's audio
        └── user789.wav         # Charlie's audio
```

## ByteNite Integration

These test files demonstrate ByteNite's capabilities:

- **Audio Transcription**: Converting speech to text using Whisper
- **Job Management**: Creating, monitoring, and retrieving results from ByteNite jobs
- **File Handling**: Uploading audio files and downloading processed results
- **API Authentication**: Working with ByteNite's authentication system 