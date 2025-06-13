# DecisionBot Test Audio Files

This directory contains test audio files for testing the DecisionBot transcription and decision extraction pipeline.

## Generated Files

The `generate-test-audio.sh` script creates 3 audio files representing different participants in a meeting:

- **user123.wav** - Alice (Project Manager, Samantha voice)
- **user456.wav** - Bob (Developer, Alex voice)  
- **user789.wav** - Charlie (Designer, Victoria voice)

## Meeting Scenario

The audio simulates a team meeting where participants discuss and make the following decisions:

1. **Ship API v2 on June 20th** - Discussed by Alice and confirmed by Bob
2. **Upgrade to Node 20** - Proposed by Bob as a prerequisite  
3. **Skip next week's retrospective** - Suggested by Charlie

## Audio Properties

- **Format**: WAV (RIFF, little-endian)
- **Sample Rate**: 22.05 kHz
- **Bit Depth**: 16-bit
- **Duration**: ~14-15 seconds each
- **Compatible with**: OpenAI Whisper transcription

## Usage

1. Run the generation script:
   ```bash
   ./generate-test-audio.sh
   ```

2. The files will be created in `./audio-test-data/test-meeting-<timestamp>/`

3. Use these files to test:
   - ByteNite transcription pipeline
   - Decision extraction via GMI Cloud service
   - End-to-end DecisionBot workflow

## Expected Behavior

When processed by the DecisionBot pipeline, these audio files should:

1. Be transcribed accurately by the transcription service
2. Have 3 decisions extracted by the GMI decision-extraction service
3. Generate confirmation DMs to participants
4. Post approved decisions to the #decisions channel

This matches the test scenarios outlined in the BDD test cases from the Product Requirements Document. 