# === BYTENITE APP - MAIN SCRIPT ===

# Documentation: https://docs.bytenite.com/create-with-bytenite/building-blocks/apps

# == Imports and Environment Variables ==

# Ensure all required external libraries are available in the Docker container image specified in manifest.json under "platform_config" > "container".
try:
    import json
    import os
    import logging
    import whisper
    import tempfile
except ImportError as e:
    raise ImportError(f"Required library is missing: {e}")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Path to the directory containing a single data chunk, passed by your partitioner.
# Note: This folder is automatically created and contains only one chunk. You don't need to create or manage it.
task_dir = os.getenv('TASK_DIR')
if not task_dir:
    raise ValueError("TASK_DIR environment variable is not set or is invalid.")

# Path to the folder where your app's task results must be saved. The assembler will access these files across all runs of your app.
# Note: The folder is automatically created and passed to your app. There is no required output format—just ensure your assembler can read the files.
task_results_dir = os.getenv('TASK_RESULTS_DIR')
if not task_results_dir:
    raise ValueError("TASK_RESULTS_DIR environment variable is not set or is invalid.")

# App parameters imported from the job request (located under "params" -> "app").
app_params_raw = os.getenv('APP_PARAMS')
if not app_params_raw:
    raise ValueError("APP_PARAMS environment variable is not set or is empty.")
try:
    app_params = json.loads(app_params_raw)
except json.JSONDecodeError as e:
    raise ValueError(f"APP_PARAMS environment variable contains invalid JSON: {e}")

# == Utility Functions ==

def read_chunk():
    """Reads the data chunk from the specified chunk path."""
    chunk_path = os.path.join(task_dir, 'data.bin')
    try:
        with open(chunk_path, 'rb') as file:
            data = file.read()
        return data
    except OSError as e:
        raise RuntimeError(f"Error reading chunk file '{chunk_path}': {e}")

def write_task_result(filename, data):
    """Writes the processed data to the task results directory."""
    output_path = os.path.join(task_results_dir, filename)
    try:
        with open(output_path, 'w') as outfile:
            outfile.write(data)
        logger.info(f"Output saved to {output_path}")
    except OSError as e:
        raise RuntimeError(f"Error writing output file '{output_path}': {e}")

# == Main Logic ==

# This is the main function of your app. It will be executed when the job is run.
if __name__ == '__main__':
    logger.info("App task started")
    
    # == Your Code ==

    # 1. Reading Inputs
    
    # Read and process the input data from chunk_path.
    # This is a single data chunk from your partitioner, or the full data source file if using a passthrough partitioner.
    logger.info("Reading audio chunk...")
    audio_data = read_chunk()
    logger.info(f"Read {len(audio_data)} bytes of audio data")

    # ------------------------

    # 2. Handling Parameters
    
    # Access parameters from the app_params dict.
    # These are the job parameters submitted in the job request under params.app.
    model_name = app_params.get('model', 'turbo')  # Default to turbo model
    logger.info(f"Using Whisper model: {model_name} with auto-detect language and transcribe task")

    # ------------------------

    # 3. Developing the Core Functionality
    
    # Develop your app's core processing functionality here.
    try:
        # Create a temporary file for the audio data
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        logger.info("Loading Whisper model...")
        model = whisper.load_model(model_name)
        
        logger.info("Starting transcription...")
        result = model.transcribe(temp_audio_path)
        
        logger.info("Transcription completed successfully")
        
        # Clean up temporary file
        os.unlink(temp_audio_path)
        
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        raise RuntimeError(f"Transcription failed: {e}")

    # ------------------------

    # 4. Saving Outputs
    
    # Save your output files to task_results_dir.
    # These files will be accessible by your assembler or sent to the job's data destination if using a passthrough assembler.
    
    # Prepare the output data
    output_data = {
        "text": result["text"],
        "language": result.get("language", "unknown"),
        "segments": result.get("segments", []),
        "model_used": model_name,
    }
    
    # Save as JSON
    output_json = json.dumps(output_data, indent=2, ensure_ascii=False)
    write_task_result("transcription_result.json", output_json)
    
    logger.info("App task completed successfully")
