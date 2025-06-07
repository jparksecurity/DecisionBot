# Product Requirements Document (PRD) – v0.2

**Product:** DecisionBot (Ambient Decision‑Capture for Discord)

**Date:** 6 Jun 2025

**Owner:** *John Park*

---

## 1   Purpose

Capture informal decisions made during Discord voice meetings and publish them asynchronously with minimal user effort.

---

## 2   Problem Statement

Remote teammates miss out on critical "hallway‑style" decisions made in live calls. Manually typing summaries is error‑prone and rarely done.

---

## 3   Goals & Metrics

| Goal                      | Metric                                     | Target                    |
| ------------------------- | ------------------------------------------ | ------------------------- |
| Automate decision capture | Meetings with at least one logged decision | ≥ 90 %                    |
| Low friction              | Avg actions per participant                | ≤ 1 (react or ignore)     |
| Timeliness                | Latency: meeting end → post                | ≤ 2 min for ≤ 1 h meeting |
| Reliability               | Sessions lost due to errors                | < 1 %                     |

---

## 4   Non‑Goals

* Multiplatform support (Discord only)
* Real‑time captions
*

---

## 5   Stakeholders

* Product/PM, Engineering, Dev‑Ops (Langtrace), Security

---

## 6   Personas

\| Persona | Need |
|Remote Dev|Catch up on overnight decisions|
|Team Lead|Trace decision history|
|Ops|Monitor pipeline health|

---

## 7   Solution Overview

1. **Auto‑join** – Bot enters a voice channel automatically when the first non‑bot user joins.
2. **Record** – Per‑speaker Opus → WAV via `discord.js + @discordjs/voice + prism‑media`.
3. **Meeting end** – Triggered only when channel empties (`allParticipants.size === 0`).
4. **Transcribe** – Upload WAV files to ByteNite; poll every 10 s until Whisper transcripts ready.
5. **Decision extraction** – Send transcripts to GMI Cloud; receive candidate decisions (text, speakerId).
6. **Confirm** – DM allParticipants a list of candidates; ❌ within 60 s cancels a candidate.
7. **Publish** – Post remaining decisions to **#decisions**; include date/time & participant list.  Canceled items generate a "Decision canceled" notice.
8. **Cleanup** – Delete temp audio immediately after publish/abort.
9. **Observability** – Emit OpenTelemetry spans via Langtrace (traceId `meeting:<guildId>:<startTs>`).

---

## 8   Functional Requirements

**FR‑1 Auto‑Join / Removal**
• Bot joins any voice channel when the first user joins.
• Command `/decisionbot remove` (or standard kick) detaches bot; if removed before meeting end, discard all captured data and skip processing.

**FR‑2 Audio Capture**
Decode per‑speaker Opus to 48 kHz 16‑bit WAV; save to `/tmp/meet/<meetingId>/<userId>.wav`.

**FR‑3 Participants Set**
Maintain `allParticipants` = every user who ever joined during session.

**FR‑4 Meeting End**
Session ends when `allParticipants.size === 0` (channel empty). Idle‑timeout logic removed.

**FR‑5 Transcription Upload**
POST each WAV to ByteNite File‑Upload; store jobIds; poll every 10 s until all transcripts returned.

**FR‑6 Decision Extraction**
Send combined transcripts to GMI `decision-extractor-v1`; receive array `{text, speakerId}`.

**FR‑7 Zero‑Decision Case**
If GMI returns **no** decision candidates, DM every user in `allParticipants` with:

> "No decisions were automatically detected for this meeting. React with ❌ within 60 s if a decision was actually made and I missed it."
> • If any ❌ arrives → flag the session for manual follow‑up by posting a clarification request in #decisions.
> • If no ❌, post "No decisions detected (confirmed by participants)" to #decisions.

**FR‑8 Confirmation UX**
DM every user in `allParticipants` a message per candidate with ❌ reaction option.
• Start 60 s timer per candidate.
• If any ❌ arrives → mark canceled.
• After 60 s, proceed with uncanceled set.

**FR‑9 Publish & Cancel Notices**
• Post uncanceled decisions to #decisions (no @here tag).
• For each canceled decision, also post "*Canceled by participant*" note.

**FR‑10 Immediate Cleanup**
Delete WAV files and in‑memory buffers once publish/abort completes.

**FR‑11 Langtrace**
Wrap steps (join, capture, upload, poll, GMI, DM, publish, cleanup). Custom attribute `meeting_id` & `guild_id`. Langtrace supports arbitrary traceId via OpenTelemetry standard.

**FR‑12 Error Handling**
• Retry ByteNite & GMI 3× exp‑backoff.
• If ByteNite fails, run local regex fallback on concatenated transcript.
• Log all failures in #decisionbot‑logs.

---

## 9   Non‑Functional

* Performance, scalability, security, privacy same as v0.1 except audio cleanup now immediate.

---

## 10  BDD Test Cases

All scenarios use Gherkin syntax and address every functional requirement.

```gherkin
Feature: Decision capture and confirmation

  # --- Core happy path ---
  Scenario: Happy path decision logging
    Given DecisionBot auto‑joins a voice channel with Alice and Bob
    And both users speak and leave the channel
    When transcription and decision extraction return "Ship API v2 on 20 June"
    And DecisionBot DMs Alice and Bob
    And no user reacts with ❌ within 60 seconds
    Then DecisionBot posts the decision to #decisions
    And the temporary audio files are deleted immediately

  # --- Multiple candidates + selective cancel ---
  Scenario: Two decisions, one canceled
    Given GMI returns two decisions: "Upgrade to Node 20" and "Skip next week's retro"
    And DecisionBot DM‑prompts all participants
    When Charlie reacts ❌ on "Skip next week's retro" within 60 seconds
    Then DecisionBot posts only "Upgrade to Node 20" to #decisions
    And posts "'Skip next week's retro' canceled by participant" notice

  # --- Zero‑decision flow with participant confirmation ---
  Scenario: No decisions detected but confirmed
    Given DecisionBot records a meeting that contains no decision keywords
    And GMI returns no decision candidates
    When DecisionBot DMs participants with "No decisions were automatically detected"
    And no participant reacts with ❌ within 60 seconds
    Then DecisionBot posts "No decisions detected (confirmed by participants)" to #decisions

  # --- ByteNite failure triggers regex fallback ---
  Scenario: ByteNite unavailable, local regex fallback succeeds
    Given ByteNite returns HTTP 500 for three consecutive upload polls
    When DecisionBot falls back to local regex and finds "Adopt Dark Mode by Q3" in the raw transcript
    Then DecisionBot proceeds with DM confirmation for that decision
    And publishes the decision if no ❌ reaction occurs

  # --- Immediate cleanup verification ---
  Scenario: Temp audio cleaned after publish
    Given DecisionBot publishes decisions for a finished meeting
    Then the meeting's WAV directory is removed from /tmp within 5 seconds

  # --- Slow transcription but within SLA ---
  Scenario: ByteNite polling takes 30 seconds
    Given ByteNite responds "processing" twice at 10‑second intervals
    When transcripts arrive on the third poll
    Then DecisionBot still posts confirmed decisions within 2 minutes of meeting end

  # --- Langtrace span emission ---
  Scenario: Observability spans are recorded
    Given a complete happy‑path session
    Then Langtrace contains spans named "join", "upload", "gmi", "dm", "publish", and "cleanup" under the same traceId

  # --- Bot removed mid‑meeting ---
  Scenario: Bot removed before meeting ends
    Given DecisionBot is kicked from the voice channel while users remain
    When the channel later empties
    Then DecisionBot performs no transcription or posting
    And any partial audio is deleted immediately

  # --- DM permission failure fallback ---
  Scenario: User with closed DMs
    Given Alice has DMs disabled
    And DecisionBot attempts to DM Alice a decision candidate
    Then DecisionBot mentions @Alice in #decisions requesting review
    And continues the 60‑second confirmation window for other users

  # --- Late ❌ reaction ignored ---
  Scenario: Cancel reaction after timeout
    Given DecisionBot has posted a decision to #decisions
    When Bob reacts with ❌ on the original DM after the 60‑second window has expired
    Then the decision remains in #decisions and no cancellation notice is posted
```

## 11  TDD Unit‑Level Test Plan

Unit tests are split into three layers: **TypeScript bot modules (Jest)**, **Python ByteNite service (pytest)**, and **cross‑service integration tests**. All external dependencies are mocked (Discord, ByteNite REST, GMI Cloud, Langtrace exporter, FFmpeg CLI).

### 11.1  TypeScript Unit Tests (Jest)

| Module / Class          | Test ID | Description                                                                  | Expected Outcome |
| ----------------------- | ------- | ---------------------------------------------------------------------------- | ---------------- |
| **VoiceManager**        | VM‑1    | `joinOnFirstMember()` – first human joins → bot joins & `state=="recording"` | Pass             |
|                         | VM‑2    | `ignoreRejoin()` – user leaves & rejoins → `allParticipants` size unchanged  | Pass             |
|                         | VM‑3    | `handleKick()` – bot kicked → `skipProcessing==true`, streams closed         | Pass             |
|                         | VM‑4    | `handleDisconnection()` – VoiceConnectionStatus.Disconnected → cleanup       | Pass             |
|                         | VM‑5    | `ignoreBotVoiceUpdates()` – bot voice state changes ignored                  | Pass             |
|                         | VM‑6    | `handleChannelMove()` – user moves between channels → session transfer       | Pass             |
| **Recorder**            | REC‑1   | `encodePcmToWav()` writes `.wav` ≥1 KB                                       | Pass             |
|                         | REC‑2   | `perSpeakerFiles()` – two speakers → two distinct WAVs                       | Pass             |
|                         | REC‑3   | `opusToWavFFmpeg()` – converts Opus to 48kHz 16‑bit WAV using FFmpeg CLI     | Pass             |
|                         | REC‑4   | `validateAudioSize()` – rejects files smaller than 1KB threshold             | Error thrown     |
|                         | REC‑5   | `handleConcurrentSpeakers()` – multiple speakers → separate stream handling   | Pass             |
|                         | REC‑6   | `handleAudioStreamDrop()` – Discord packet loss → graceful recovery          | Pass             |
| **MeetingManager**      | MM‑1    | `detectChannelEmpty()` fires once when channel empties                       | Pass             |
|                         | MM‑2    | `enforceTimeSLA()` – processing completes within 2 min for ≤1h meeting       | Pass             |
|                         | MM‑3    | `handleProcessingMemoryLimit()` – large meetings → memory cleanup            | Pass             |
| **ByteNiteAdapter**     | BN‑1    | `enqueueUpload()` sends POST → stores jobId                                  | jobId saved      |
|                         | BN‑2    | `pollUntilDone()` – 3 "processing" polls then "done" → resolves              | transcript array |
|                         | BN‑3    | `pollTimeout()` – 30 polls all "processing" → throws TimeoutError            | Error caught     |
|                         | BN‑4    | `uploadRetry()` – first 2 POST 500, 3rd 200 → succeeds                       | jobId saved      |
|                         | BN‑5    | `validateFileFormat()` – accepts WAV/MP3/M4A/FLAC/OGG, rejects others        | Pass/Error       |
|                         | BN‑6    | `handleLargeFiles()` – >50MB files → chunked upload or error                 | Pass/Error       |
| **TranscriberService**  | TS‑1    | `mergeTranscripts()` returns combined array sorted by start                  | Pass             |
|                         | TS‑2    | `handleOverlappingSpeech()` – concurrent speakers → merged timestamps        | Pass             |
| **DecisionExtractor**   | DE‑1    | `callGMI()` returns two decisions                                            | array length 2   |
|                         | DE‑2    | `emptyResponse()` sets `noDecision==true`                                    | flag true        |
|                         | DE‑3    | `regexFallback()` – GMI fails → local regex finds decisions                  | decisions found  |
|                         | DE‑4    | `deduplicateDecisions()` – similar decisions merged                          | unique decisions |
|                         | DE‑5    | `filterGenericPhrases()` – excludes "we should do something"                 | filtered out     |
| **ConfirmationService** | CS‑1    | `dmAllParticipants()` sends one DM per user                                  | msgIds array     |
|                         | CS‑2    | `cancelOnReaction()` within 60 s → status `canceled`                         | Pass             |
|                         | CS‑3    | `lateReactionIgnored()` after 60 s → status `posted`                         | Pass             |
|                         | CS‑4    | `handleDMPermissionDenied()` – closed DMs → fallback to channel mention      | mention posted   |
|                         | CS‑5    | `handleMultipleReactions()` – same user reacts to multiple decisions         | all canceled     |
| **Publisher**           | PUB‑1   | `postDecision()` markdown matches snapshot                                   | Pass             |
|                         | PUB‑2   | `postCanceledNotice()` posts exactly 1 notice                                | Pass             |
|                         | PUB‑3   | `noDecisionConfirmed()` – posts "no decisions detected (confirmed)"          | Pass             |
|                         | PUB‑4   | `formatTimestamps()` – includes date/time & participant list                  | Pass             |
| **CleanupManager**      | CLN‑1   | `deleteTmpFiles()` removes `/tmp/meet/<id>`                                  | dir missing      |
|                         | CLN‑2   | `immediateCleanup()` – files deleted within 5s of publish                    | Pass             |
|                         | CLN‑3   | `cleanupOnError()` – partial data deleted on session abort                   | dir missing      |
|                         | CLN‑4   | `cleanupMemoryBuffers()` – in‑memory audio streams cleared                   | memory freed     |
| **Observability**       | OBS‑1   | `langtraceSpans()` captures spans `join,upload,gmi,dm,publish,cleanup`       | trace length ≥6  |
|                         | OBS‑2   | `meetingTraceId()` – format `meeting:<guildId>:<startTs>`                    | correct format   |
|                         | OBS‑3   | `spanAttributes()` – includes meeting_id, guild_id, user_id                  | attributes set   |
|                         | OBS‑4   | `errorRecording()` – exceptions recorded with SpanStatusCode.ERROR           | error span       |
|                         | OBS‑5   | `traceContextPropagation()` – context flows across service boundaries        | Pass             |
|                         | OBS‑6   | `customSpanEvents()` – records key decision points as events                 | events captured  |

### 11.2  Python ByteNite Service Tests (pytest)

| Module / Function        | Test ID | Description                                                    | Expected Outcome                      |
| ------------------------ | ------- | -------------------------------------------------------------- | ------------------------------------- |
| **Core Functions**       | PY‑C1   | `install_requirements()` – installs whisper and requests      | imports succeed after call           |
|                          | PY‑C2   | `transcribe_audio()` – valid WAV file → returns transcript    | dict with text, segments, language    |
|                          | PY‑C3   | `process_file()` – valid audio → transcription result         | result dict returned                  |
|                          | PY‑C4   | `process_file()` with output path → saves JSON file           | JSON file created and valid           |
| **Input Validation**     | PY‑I1   | `process_file()` – missing input file → FileNotFoundError     | Exception raised                      |
|                          | PY‑I2   | `main()` – no args or env vars → shows usage message          | usage printed, returns 1              |
|                          | PY‑I3   | `main()` – valid INPUT_FILE env var → processes file          | success, returns 0                    |
|                          | PY‑I4   | `main()` – command line args → processes file                 | success, returns 0                    |
| **Error Handling**       | PY‑E1   | `transcribe_audio()` – corrupted audio → graceful error       | Exception with clear message          |
|                          | PY‑E2   | `process_file()` – unreadable output path → handles error     | IOError handled gracefully            |
|                          | PY‑E3   | `main()` – general exception → returns 1                      | error logged, non-zero exit           |
| **File Operations**      | PY‑F1   | Output JSON contains expected keys (text, segments, language)  | all required keys present             |
|                          | PY‑F2   | Handles various audio formats (WAV, MP3, M4A, etc.)          | transcription works for all formats   |
|                          | PY‑F3   | Large audio files processed without memory issues             | successful processing                 |
| **Environment**          | PY‑ENV1 | Script works without pre-installed dependencies               | auto-installs and continues           |
|                          | PY‑ENV2 | Environment variables take precedence over command args       | correct file processed                |
|                          | PY‑ENV3 | Script executable directly from command line                  | runs without python prefix            |

### 11.3  Integration Tests (Jest + subprocess for ByteNite script)

| Scenario                    | Test ID | Description                                               | Expected Outcome                                 |
| --------------------------- | ------- | --------------------------------------------------------- | ------------------------------------------------ |
| **End‑to‑End Flow**         | INT‑1   | Mock Discord voice, ByteNite transcripts, GMI decisions  | DM sent, decision posted                         |
|                             | INT‑2   | ByteNite 500s → regex fallback → decision flow           | decision posted, Langtrace span `fallback==true` |
|                             | INT‑3   | Complete meeting lifecycle with real services             | all components integrated                        |
| **Performance Tests**       | INT‑4   | 1‑hour meeting processed within 2‑minute SLA             | completion time <2min                            |
|                             | INT‑5   | Multiple concurrent meetings → no resource conflicts      | all complete successfully                        |
| **Error Recovery**          | INT‑6   | Network failures → retry with exponential backoff        | eventual success                                 |
|                             | INT‑7   | Partial failures → graceful degradation                   | partial results posted                           |
| **Security & Privacy**      | INT‑8   | Audio files deleted after processing                      | no temp files remain                             |
|                             | INT‑9   | No sensitive data in logs                                 | logs sanitized                                   |
| **Observability**           | INT‑10  | Distributed tracing across all services                   | complete trace spans                             |
|                             | INT‑11  | Error spans captured with correct attributes              | error telemetry complete                         |

### 11.4  Performance & Load Tests

| Test Category           | Test ID | Description                                          | Expected Outcome        |
| ----------------------- | ------- | ---------------------------------------------------- | ----------------------- |
| **Latency**             | PERF‑1  | Meeting end → decision post latency                  | ≤2 min for ≤1h meeting |
|                         | PERF‑2  | ByteNite transcription response time                 | ≤30s for 10min audio   |
| **Throughput**          | PERF‑3  | Concurrent meetings processing                       | ≥5 meetings parallel    |
|                         | PERF‑4  | Audio file upload throughput                         | ≥10MB/s average         |
| **Resource Usage**      | PERF‑5  | Memory usage during audio processing                 | ≤512MB per meeting      |
|                         | PERF‑6  | CPU usage during transcription                       | ≤80% average            |

### Tooling Notes

* **Jest** with `jest.useFakeTimers()` for 60s windows and timeout simulation.
* **nock** intercepts HTTP for ByteNite & GMI API calls.
* **ts‑auto‑mock** or **jest‑mock‑extended** for Discord.js objects and voice connections.
* **pytest** with mocked file system operations and audio processing for ByteNite script testing.
* **tempfile** and **unittest.mock** for testing file I/O operations safely.
* **InMemorySpanExporter** validates Langtrace spans and OpenTelemetry traces.
* **Docker Compose** for integration test environment with real services.
* **Artillery** or **k6** for load testing scenarios.
