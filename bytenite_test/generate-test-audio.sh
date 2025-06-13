#!/bin/bash

# Generate test audio files for DecisionBot testing
# Simulates a meeting with 3 participants discussing decisions

echo "Generating test audio files for DecisionBot..."

# Create meeting directory structure like the bot would
MEETING_ID="test-meeting-$(date +%s)"
MEETING_DIR="./audio-test-data/$MEETING_ID"
mkdir -p "$MEETING_DIR"

echo "Meeting directory: $MEETING_DIR"

# Participant 1 (Alice) - Project Manager voice
echo "Generating Alice's audio (user123.wav)..."
say -v Samantha -r 160 --data-format=LEI16@22050 -o "$MEETING_DIR/user123.wav" \
"Alright team, let's discuss the API migration. I think we should ship API version 2 on June twentieth. The current version has some performance issues that are affecting our users. What do you think about this timeline?"

# Participant 2 (Bob) - Developer voice  
echo "Generating Bob's audio (user456.wav)..."
say -v Alex -r 150 --data-format=LEI16@22050 -o "$MEETING_DIR/user456.wav" \
"That sounds reasonable Alice. I agree we should ship API v2 on June twentieth. Also, I think we need to upgrade to Node 20 before then. The new features will help with the migration and it's more stable than our current version."

# Participant 3 (Charlie) - Designer voice
echo "Generating Charlie's audio (user789.wav)..."
say -v Victoria -r 155 --data-format=LEI16@22050 -o "$MEETING_DIR/user789.wav" \
"Great points everyone. I'm on board with both decisions. Let's also decide to skip next week's retrospective since we'll be busy with the API work. We can have a longer retro the following week to cover everything."

echo ""
echo "✅ Generated 3 test audio files:"
echo "   - $MEETING_DIR/user123.wav (Alice - PM)"
echo "   - $MEETING_DIR/user456.wav (Bob - Dev)" 
echo "   - $MEETING_DIR/user789.wav (Charlie - Designer)"
echo ""
echo "Expected decisions to be extracted:"
echo "   1. Ship API v2 on June 20th"
echo "   2. Upgrade to Node 20" 
echo "   3. Skip next week's retrospective"
echo ""
echo "Audio files are ready for ByteNite transcription testing!" 