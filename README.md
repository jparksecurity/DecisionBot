# DecisionBot

Ambient decision capture for Discord voice meetings. Automatically records, transcribes, and extracts decisions from voice conversations with participant confirmation.

## Features

- **Auto-join**: Bot automatically joins voice channels when first human user joins
- **Per-speaker recording**: Records separate audio streams for each participant  
- **Transcription**: Uses Whisper via ByteNite service for accurate speech-to-text
- **Decision extraction**: GMI Cloud API identifies potential decisions with regex fallback
- **Participant confirmation**: DM confirmation system with ❌ reaction to cancel decisions
- **Publishing**: Posts confirmed decisions to #decisions channel with cancellation notices
- **Observability**: Full OpenTelemetry tracing via Langtrace

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Discord Bot   │    │  ByteNite        │    │   GMI Cloud     │
│   (TypeScript)  │────│  Service         │────│   Decision      │
│                 │    │  (Python/FastAPI)│    │   Extractor     │
│  • VoiceManager │    │  • Whisper       │    │                 │
│  • Recorder     │    │  • Job Queue     │    │                 │
│  • Confirmation │    │  • File Storage  │    │                 │
│  • Publisher    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                         ┌─────────────────┐
                         │   Langtrace     │
                         │  Observability  │
                         └─────────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Discord Bot Token with appropriate permissions
- GMI Cloud API key
- Langtrace API key

### Environment Variables

Create `.env` files based on the `.env.example` files in both `bot/` and `bytenite_service/` directories.

#### Bot Configuration (bot/.env)

```bash
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here  
DISCORD_GUILD_ID=your_guild_id_here
DECISIONS_CHANNEL_ID=your_decisions_channel_id_here
LOGS_CHANNEL_ID=your_logs_channel_id_here

# ByteNite Service
BYTENITE_SERVICE_URL=http://localhost:8000

# GMI Cloud Configuration  
GMI_CLOUD_API_KEY=your_gmi_api_key_here
GMI_CLOUD_BASE_URL=https://api.gmi.cloud

# Langtrace Configuration
LANGTRACE_API_KEY=your_langtrace_api_key_here
LANGTRACE_ENDPOINT=https://cloud.langtrace.ai

# Environment
NODE_ENV=development
```

#### ByteNite Service Configuration (bytenite_service/.env)

```bash
# FastAPI Configuration
PORT=8000
HOST=0.0.0.0

# Whisper Configuration
WHISPER_MODEL=base
WHISPER_DEVICE=cpu

# File Storage
UPLOAD_DIR=/tmp/bytenite_uploads
MAX_FILE_SIZE_MB=100

# Environment
ENVIRONMENT=development
```

### Installation

1. **Install Bot Dependencies**:
```bash
cd bot
npm install
```

2. **Install ByteNite Service Dependencies**:
```bash
cd bytenite_service
pip install poetry
poetry install
```

### Running the Services

1. **Start ByteNite Service**:
```bash
cd bytenite_service
python start.py
```

2. **Start Discord Bot**:
```bash
cd bot
npm run dev
```

### Discord Bot Setup

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot user and copy the token
3. Add bot to your server with permissions:
   - Read Messages
   - Send Messages  
   - Connect to Voice
   - Speak in Voice
   - Add Reactions
   - Send Messages in DMs

## Usage

1. **Automatic Operation**: Bot joins voice channels automatically when users join
2. **Meeting Flow**:
   - Users join voice channel → Bot joins and starts recording
   - Users leave channel → When empty, bot processes the meeting
   - Transcription → Decision extraction → Participant confirmation → Publishing
3. **Manual Removal**: Use `/decisionbot remove` or kick bot to cancel recording

## Testing

### TypeScript Tests
```bash
cd bot
npm test                 # Run all tests
npm run test:watch      # Watch mode
```

### Python Tests  
```bash
cd bytenite_service
poetry run pytest              # Run all tests
poetry run pytest --cov       # With coverage
```

## Key Components

### VoiceManager
Handles Discord voice channel events, manages recording sessions

### RecorderService  
Records per-speaker audio streams as WAV files

### ByteNiteAdapter
Interfaces with transcription service, handles retries and fallbacks

### DecisionExtractor
GMI Cloud integration with regex fallback for decision detection

### ConfirmationService
DM system for participant confirmation with reaction handling

### Publisher
Posts decisions and cancellation notices to Discord channels

## Observability

All operations are traced through Langtrace with custom attributes:
- `meeting_id`: Unique meeting identifier
- `guild_id`: Discord server ID  
- Span names: `join`, `upload`, `gmi`, `dm`, `publish`, `cleanup`

## Error Handling

- **Retry Logic**: 3x exponential backoff for external services
- **Fallbacks**: Local regex if ByteNite/GMI fail
- **Cleanup**: Immediate audio file deletion after processing
- **Logging**: Comprehensive error logging to #decisionbot-logs channel

## Performance

- **Latency Target**: ≤ 2 minutes from meeting end to decision post
- **Concurrency**: Parallel audio uploads and transcription
- **Resource Management**: Automatic cleanup of temporary files
- **Scalability**: Stateless design supports multiple concurrent meetings