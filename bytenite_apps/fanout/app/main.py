# === BYTENITE PARTITIONER - MAIN SCRIPT ===

# Read the documentation --> https://docs.bytenite.com/create-with-bytenite/building-blocks/partitioning-engines

# == Imports and Environment Variables ==

# Ensure all required external libraries are available in the Docker container image specified in manifest.json under "platform_config" > "container".
try:
    import json
    import os
    import re
    import logging
    import zipfile
    import tempfile
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
    """Reads and returns the binary content of the zip file in the source directory."""
    try:
        for filename in os.listdir(source_dir):
            file_path = os.path.join(source_dir, filename)
            if os.path.isfile(file_path) and filename.lower().endswith('.zip'):
                with open(file_path, "rb") as file:
                    return file.read()
        
        # If no zip file found, check for any single file (could be renamed)
        files = [f for f in os.listdir(source_dir) if os.path.isfile(os.path.join(source_dir, f))]
        if len(files) == 1:
            file_path = os.path.join(source_dir, files[0])
            with open(file_path, "rb") as file:
                return file.read()
        
        raise RuntimeError("No zip file found in source directory")
    except OSError as e:
        raise RuntimeError(f"Error accessing source directory '{source_dir}': {e}")
    except Exception as e:
        raise RuntimeError(f"Error reading zip file in '{source_dir}': {e}")

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
    # Read the zip file binary content from the source directory
    logger.info(f"Reading zip file from source directory: {source_dir}")
    
    try:
        zip_data = read_source_files()
        logger.info(f"Successfully read zip file ({len(zip_data)} bytes)")
    except RuntimeError as e:
        logger.error(f"Failed to read zip file: {e}")
        logger.info("Partitioner task completed - no zip file to process")
        exit(1)

    # ------------------------

    # 2. Performing Pre-Processing Operations
    # Extract audio files from the zip content in memory
    logger.info("Pre-processing: Extracting audio files from zip content...")
    
    audio_files = []
    supported_formats = {'.mp3', '.wav', '.m4a', '.flac', '.mp4', '.avi', '.mov', '.mkv', '.webm'}
    
    try:
        # Create a temporary file to work with the zip data
        with tempfile.NamedTemporaryFile() as temp_zip_file:
            temp_zip_file.write(zip_data)
            temp_zip_file.flush()
            
            # Extract audio files from the zip
            with zipfile.ZipFile(temp_zip_file.name, 'r') as zip_ref:
                for file_info in zip_ref.infolist():
                    if not file_info.is_dir():
                        file_ext = os.path.splitext(file_info.filename)[1].lower()
                        if file_ext in supported_formats:
                            # Extract the audio file content
                            audio_data = zip_ref.read(file_info.filename)
                            audio_files.append((file_info.filename, audio_data))
                            logger.info(f"Extracted audio file: {file_info.filename} ({len(audio_data)} bytes)")
    
    except zipfile.BadZipFile:
        logger.error("Invalid zip file content")
        logger.info("Partitioner task completed - invalid zip file")
        exit(1)
    except Exception as e:
        logger.error(f"Error extracting zip content: {e}")
        logger.info("Partitioner task completed - extraction failed")
        exit(1)
    
    if not audio_files:
        logger.warning("No audio files found in zip content")
        logger.info("Partitioner task completed - no audio files to process")
        exit(0)
    
    logger.info(f"Total audio files extracted: {len(audio_files)}")

    # ------------------------

    # 3. Fanning Out Data
    # Fan out the audio data into chunks
    logger.info("Creating chunks for each audio file...")
    
    processed_count = 0
    for filename, audio_data in audio_files:
        try:
            # Create a chunk for this audio file
            save_chunk(audio_data)
            processed_count += 1
            logger.info(f"Created chunk for audio file: {filename} ({len(audio_data)} bytes)")
            
        except Exception as e:
            logger.error(f"Failed to process audio file {filename}: {e}")
            continue
    
    logger.info(f"Partitioner task completed - created {processed_count} chunks from {len(audio_files)} audio files")

    # ------------------------
