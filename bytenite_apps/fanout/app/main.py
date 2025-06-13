# === BYTENITE PARTITIONER - MAIN SCRIPT ===

# Read the documentation --> https://docs.bytenite.com/create-with-bytenite/building-blocks/partitioning-engines

# == Imports and Environment Variables ==

# Ensure all required external libraries are available in the Docker container image specified in manifest.json under "platform_config" > "container".
try:
    import json
    import os
    import re
    import logging
except ImportError as e:
    raise ImportError(f"Required library is missing: {e}")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Path to the folder where your data lives. This folder will be automatically populated with the files imported from your data source.
source_dir = os.getenv("SOURCE_DIR")
if source_dir is None:
    raise ValueError("Environment variable 'SOURCE_DIR' is not set.")
if not os.path.isdir(source_dir):
    raise ValueError(f"Source directory '{source_dir}' does not exist or is not accessible.")

chunks_dir = os.getenv("CHUNKS_DIR")
if not chunks_dir:
    raise ValueError("Environment variable 'CHUNKS_DIR' is not set.")
if not os.path.isdir(chunks_dir):
    raise ValueError(f"Chunks directory '{chunks_dir}' does not exist or is not a directory.")
if not os.access(chunks_dir, os.W_OK):
    raise ValueError(f"Chunks directory '{chunks_dir}' is not writable.")
# Define the naming convention for chunks
chunk_file_naming = "data_{chunk_index}.bin"

# The partitioner parameters as imported from the job body in "params" -> "partitioner".
try:
    partitioner_params = os.getenv("PARTITIONER_PARAMS")
    if not partitioner_params:
        raise ValueError("Environment variable 'PARTITIONER_PARAMS' is not set.")
    params = json.loads(partitioner_params)
except json.JSONDecodeError:
    raise ValueError("Environment variable 'PARTITIONER_PARAMS' contains invalid JSON.")


# === Utility Functions ===

def read_source_files():
    """Reads and returns the content of all files in the results directory as a list of strings."""
    source_files = []
    try:
        for filename in os.listdir(source_dir):
            file_path = os.path.join(source_dir, filename)
            if os.path.isfile(file_path):
                with open(file_path, "r") as file:
                    source_files.append(file.read())
        return source_files
    except OSError as e:
        raise RuntimeError(f"Error accessing source directory '{source_dir}': {e}")
    except Exception as e:
        raise RuntimeError(f"Error reading files in '{source_dir}': {e}")

def save_chunk(data):
    """Writes a chunk of data to the next available file based on the naming convention."""
    # Use a regex pattern derived from the chunk_file_naming variable
    chunk_pattern = re.compile(re.escape(chunk_file_naming).replace(r"\{chunk_index\}", r"(\d+)"))
    
    # Determine the next chunk index
    existing_files = (
        f for f in os.listdir(chunks_dir)
        if os.path.isfile(os.path.join(chunks_dir, f)) and chunk_pattern.match(f)
    )
    chunk_indices = []
    for f in existing_files:
        match = chunk_pattern.match(f)
        if match:
            chunk_indices.append(int(match.group(1)))
    try:
        chunk_indices = sorted(chunk_indices)
        next_chunk_index = chunk_indices[-1] + 1 if chunk_indices else 0
        output_path = os.path.join(chunks_dir, chunk_file_naming.format(chunk_index=next_chunk_index))
        with open(output_path, "wb") as outfile:
            outfile.write(data)
        logger.info(f"Chunk {next_chunk_index} written to {output_path}")
    except (IOError, OSError) as e:
        raise RuntimeError(f"Failed to write chunk {next_chunk_index} to {output_path}: {e}")


# === Main Logic ===

if __name__ == "__main__":
    logger.info("Partitioner task started")

     # == Your Code ==

    # 1. Reading Data Source
    # Read your data source files, available in the source_dir directory. You can use the read_source_files function to read the content of all files in the source directory.
    logger.info(f"Reading audio files from source directory: {source_dir}")
    
    # Get list of audio files in source directory
    audio_files = []
    supported_formats = {'.mp3', '.wav', '.m4a', '.flac', '.mp4', '.avi', '.mov', '.mkv', '.webm'}
    
    try:
        for filename in os.listdir(source_dir):
            file_path = os.path.join(source_dir, filename)
            if os.path.isfile(file_path):
                file_ext = os.path.splitext(filename)[1].lower()
                if file_ext in supported_formats:
                    audio_files.append((filename, file_path))
                    logger.info(f"Found audio file: {filename}")
    except OSError as e:
        raise RuntimeError(f"Error accessing source directory '{source_dir}': {e}")
    
    if not audio_files:
        logger.warning("No audio files found in source directory")
        logger.info("Partitioner task completed - no files to process")
        exit(0)
    
    logger.info(f"Found {len(audio_files)} audio files to process")

    # ------------------------

    # 2. Performing Pre-Processing Operations
    # Perform any pre-processing operations on the data source files here, like filtering, cleaning, or transforming the data.
    # For audio transcription, we'll pass files through as-is
    logger.info("Pre-processing: No additional processing needed for audio files")

    # ------------------------

    # 3. Fanning Out Data
    # Fan out the data into chunks by writing to the chunks_dir using the write_chunk function. Each chunk will be processed as a separate task by your application.
    logger.info("Creating chunks for each audio file...")
    
    processed_count = 0
    for filename, file_path in audio_files:
        try:
            # Read the audio file as binary data
            with open(file_path, 'rb') as audio_file:
                audio_data = audio_file.read()
            
            # Create a chunk for this audio file
            save_chunk(audio_data)
            processed_count += 1
            logger.info(f"Created chunk for audio file: {filename} ({len(audio_data)} bytes)")
            
        except Exception as e:
            logger.error(f"Failed to process audio file {filename}: {e}")
            continue
    
    logger.info(f"Partitioner task completed - created {processed_count} chunks from {len(audio_files)} audio files")

    # ------------------------
