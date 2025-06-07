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
2. **Record** – Per‑speaker Opus → WAV via `discord.js + @discordjs/voice + prism‑media`. Files are saved to a directory for the meeting.
3. **Meeting end** – Triggered only when channel empties (`allParticipants.size === 0`).
4. **Trigger Distributed Job** – Upload the entire meeting's audio directory to a ByteNite data source. Launch a single job using a template that defines a three-stage pipeline:
    *   **a) Partitioner**: A custom `directory-partitioner` creates a task for each audio file in the directory.
    *   **b) App**: The existing transcription app runs in parallel on each file, converting audio to a transcript.
    *   **c) Assembler**: A custom `decision-extractor-assembler` gathers all transcripts, combines them, calls GMI Cloud for decision extraction, and returns the final list of candidates.
5. **Get Job Result** – Poll the ByteNite job for completion and retrieves the final output from the assembler, which contains the decision candidates (`{text, speakerId}`).
6. **Confirm** – DM allParticipants a list of candidates; ❌ within 60 s cancels a candidate.
7. **Publish** – Post remaining decisions to **#decisions**; include date/time & participant list. Canceled items generate a "Decision canceled" notice.
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
Session ends when `allParticipants.size === 0` (channel empty).

**FR‑5 ByteNite Job Execution**
- On meeting end, the bot uploads the directory of WAV files to a configured ByteNite data source (e.g., a cloud bucket).
- The bot then launches a single job using a pre-defined ByteNite Job Template.
- This job executes a three-stage pipeline:
    1.  A **Partitioner** splits the work by creating a task for each audio file.
    2.  The transcription **App** processes each file in parallel.
    3.  An **Assembler** collects all transcripts, calls the GMI Cloud service for decision extraction, and produces the final result.
- The bot polls the ByteNite job for completion and retrieves the final output. The 10s polling interval from the previous design is a reasonable default.

**FR‑6 Decision Extraction**
- This step is now fully delegated to the **ByteNite Assembler**.
- The assembler is responsible for sending the combined transcript text to the GMI `decision-extractor-v1` service.
- The final output of the ByteNite job is the array of decision candidates (`{text, speakerId}`). The bot simply parses this result.

**FR‑7 Zero‑Decision Case**
If the final result from the ByteNite job is an empty list of candidates, DM every user in `allParticipants` with:

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
| **ByteNiteAdapter**     | BN‑1    | `triggerJob()` sends POST with data source → stores single jobId             | jobId saved      |
|                         | BN‑2    | `pollForFinalResult()` – polls single jobId until "done" → resolves          | decision array   |
|                         | BN‑3    | `pollTimeout()` – 30 polls all "processing" → throws TimeoutError            | Error caught     |
|                         | BN‑4    | `jobLaunchRetry()` – first 2 POST 500, 3rd 200 → succeeds                    | jobId saved      |
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
| **Observability**       | OBS‑1   | `langtraceSpans()` captures `join,triggerJob,pollJob,dm,publish,cleanup`     | trace length ≥6  |
|                         | OBS‑2   | `meetingTraceId()` – format `meeting:<guildId>:<startTs>`                    | correct format   |
|                         | OBS‑3   | `spanAttributes()` – includes meeting_id, guild_id, user_id                  | attributes set   |
|                         | OBS‑4   | `errorRecording()` – exceptions recorded with SpanStatusCode.ERROR           | error span       |
|                         | OBS‑5   | `traceContextPropagation()` – context flows into ByteNite job call           | Pass             |
|                         | OBS‑6   | `customSpanEvents()` – records key decision points as events                 | events captured  |

### 11.2  Python ByteNite Service Tests (pytest)

The Python tests are now broken down by component: Partitioner, App, and Assembler.

| Component / Module       | Test ID | Description                                                              | Expected Outcome                         |
| ------------------------ | ------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| **Partitioner**          | PART‑1  | Given input dir with 3 files, creates 3 chunks                           | 3 chunk files created                    |
|                          | PART‑2  | Given empty input dir, creates 0 chunks                                  | 0 chunk files created                    |
|                          | PART‑3  | Handles non-existent input dir gracefully                                | Error logged, non-zero exit              |
| **App (Transcription)**  | APP‑1   | `transcribe_audio()` – valid WAV file → returns transcript               | dict with text, segments, language       |
|                          | APP‑2   | `process_file()` – valid audio → transcription result                    | result dict returned                     |
|                          | APP‑3   | `process_file()` – missing input file → FileNotFoundError                | Exception raised                         |
|                          | APP‑4   | `main()` – valid INPUT_FILE env var → processes file                     | success, returns 0                       |
|                          | APP‑5   | `transcribe_audio()` – corrupted audio → graceful error                  | Exception with clear message             |
| **Assembler (Decision)** | ASM‑1   | `merge_transcripts()` – combines text from multiple input JSONs          | single concatenated string               |
|                          | ASM‑2   | `call_gmi()` – mock GMI call with merged text                            | GMI service called with correct payload  |
|                          | ASM‑3   | `regex_fallback()` – if GMI fails, local regex finds decisions           | decisions found in output                |
|                          | ASM‑4   | `main()` – processes multiple input files into a final decision JSON     | success, returns 0                       |
|                          | ASM‑5   | Handles zero input transcript files gracefully                           | empty decision array in output           |
|                          | ASM‑6   | `main()` – GMI call fails → returns 1, logs error                        | error logged, non-zero exit              |
|                          | ASM‑7   | Output JSON for decisions matches expected format                        | valid JSON with required keys            |
|                          | ASM‑8   | `install_requirements()` – installs `requests`                           | imports succeed                          |

### 11.3  Integration Tests (Jest + subprocess for ByteNite script)

| Scenario                    | Test ID | Description                                                               | Expected Outcome                                 |
| --------------------------- | ------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| **End‑to‑End Flow**         | INT‑1   | Mock Discord voice, mock single ByteNite job returns GMI decisions       | DM sent, decision posted                         |
|                             | INT‑2   | Mock ByteNite job returns a result where GMI fallback was used           | decision posted, Langtrace span `fallback==true` |
|                             | INT‑3   | Complete meeting lifecycle with real services (if possible in CI)         | all components integrated                        |
| **Performance Tests**       | INT‑4   | 1‑hour meeting processed within 2‑minute SLA (end-to-end)                | completion time <2min                            |
|                             | INT‑5   | Multiple concurrent meetings → no resource conflicts                      | all complete successfully                        |
| **Error Recovery**          | INT‑6   | Network failures to ByteNite API → retry with exponential backoff        | eventual success                                 |
|                             | INT‑7   | ByteNite job itself fails → graceful degradation, error logged           | error posted to #decisionbot-logs                |
| **Security & Privacy**      | INT‑8   | Audio files deleted after processing                                      | no temp files remain                             |
|                             | INT‑9   | No sensitive data in logs                                                 | logs sanitized                                   |
| **Observability**           | INT‑10  | Distributed tracing context propagates from Bot to ByteNite Job          | complete trace spans visible in Langtrace        |
|                             | INT‑11  | Error spans captured with correct attributes for failed ByteNite jobs    | error telemetry complete                         |

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
