# Simple ByteNite Transcription Service
This guide has been updated to reflect a more robust, multi-stage ByteNite architecture.

## 🎯 **ByteNite's Distributed Workflow**

This service now follows a proper distributed pipeline pattern, leveraging ByteNite's core building blocks:
- ✅ **Partitioner**: A new `directory-partitioner` that reads a directory of audio files and creates a separate task for each file.
- ✅ **App**: The existing `transcription-service` script (`app/main.py`) runs once for each audio file to perform transcription.
- ✅ **Assembler**: A new `decision-extractor-assembler` that gathers all the individual transcripts, combines them, calls GMI Cloud for decision extraction, and returns the final result.

This approach lets ByteNite manage the parallel execution and data flow automatically.

## 📁 **New Project Structure**

To implement this, you will need to create new components:
```
bytenite_service/
├── app/                  # The core transcription app (unchanged)
│   ├── main.py
│   └── requirements.txt
├── partitioner/          # NEW: Directory Partitioner
│   ├── main.py
│   └── manifest.json
├── assembler/            # NEW: Decision Extractor
│   ├── main.py
│   ├── requirements.txt  # Will need 'requests' for GMI Cloud
│   └── manifest.json
├── manifest.json         # DEPRECATED: each component now has its own manifest
└── template.json         # Will be updated to wire the new components
```
*You will need to run `bytenite engine new <name>` to create the partitioner and assembler.*

## 🚀 **How It Works**

1.  **Discord Bot**: After a meeting, the bot uploads all speaker audio files (`<userId>.wav`) to a single data source (e.g., a bucket directory).
2.  **Job Trigger**: The bot launches a job using the updated `template.json`.
3.  **Partitioning**: The `directory-partitioner` runs, creating a chunk for each audio file in the source directory.
4.  **App Execution**: ByteNite runs an instance of the `transcription-service` app for each chunk (file), generating a JSON transcript.
5.  **Assembling**: The `decision-extractor-assembler` receives all the JSON transcripts. It concatenates them and makes a single API call to the GMI Cloud `decision-extractor-v1` service.
6.  **Final Output**: The assembler outputs the final list of decisions, which the Discord bot can then retrieve.

### **Updated `template.json`**
Your `template.json` will need to be updated to link these three components:
```json
{
  "id": "decision-bot-pipeline-template",
  "description": "A full pipeline for transcribing audio and extracting decisions.",
  "partitioner": "directory-partitioner",
  "app": "transcription-service",
  "assembler": "decision-extractor-assembler"
}
```

## 🔧 **Component Details**

### **Partitioner: `directory-partitioner/main.py`**
This script's job is to list files in the input directory provided by ByteNite (`$INPUT_DIR`) and write each file path to the `chunks` directory. This tells ByteNite to create one app task per file.

### **Assembler: `decision-extractor-assembler/main.py`**
This script will:
1.  Wait to receive all the transcription files from the app stage.
2.  Read and concatenate the `text` from each JSON transcript.
3.  Construct a request for the GMI Cloud API.
4.  POST the combined text to GMI and get the decisions.
5.  Write the final decisions to its output file (`$OUTPUT_FILE`).

## ✅ **Benefits of this Approach**

- **Scalability**: Transcription of multiple files runs in parallel, managed by ByteNite.
- **Modularity**: Each step (partition, transcribe, assemble) is a separate, reusable component.
- **Simplicity**: The Discord bot's logic is much simpler. It just starts one job and gets the final result, instead of polling for files and calling GMI itself.
- **Efficiency**: The GMI Cloud call is made only once with the full, combined transcript.

</rewritten_file>