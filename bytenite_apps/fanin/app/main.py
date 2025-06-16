# === BYTENITE ASSEMBLER - MAIN SCRIPT ===

# Read the documentation --> https://docs.bytenite.com/create-with-bytenite/building-blocks/assembling-engines

# == Imports and Environment Variables ==

# Ensure all required external libraries are available in the Docker container image specified in manifest.json under "platform_config" > "container".
import os

try:
    import json
    import logging
    import urllib.request
    import urllib.parse
    import urllib.error
except ImportError as e:
    raise ImportError(f"Required library is missing: {e}")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Path to the folder where the task results from your app executions are stored.
task_results_dir = os.getenv("TASK_RESULTS_DIR")
if task_results_dir is None:
    raise ValueError("Environment variable 'TASK_RESULTS_DIR' is not set.")
if not os.path.isdir(task_results_dir):
    raise ValueError(f"Task result directory '{task_results_dir}' does not exist or is not accessible.")

# Path to the final output directory where your assembler results will be saved. The files in these folder will be uploaded to your data destination.
output_dir = os.getenv("OUTPUT_DIR")
if not output_dir:
    raise ValueError("Environment variable 'OUTPUT_DIR' is not set.")
if not os.path.isdir(output_dir):
    raise ValueError(f"Output directory '{output_dir}' does not exist or is not a directory.")
if not os.access(output_dir, os.W_OK):
    raise ValueError(f"Output directory '{output_dir}' is not writable.")

# The partitioner parameters as imported from the job body in "params" -> "partitioner".
try:
    assembler_params = os.getenv("ASSEMBLER_PARAMS")
    if not assembler_params:
        raise ValueError("Environment variable 'ASSEMBLER_PARAMS' is not set.")
    params = json.loads(assembler_params)
except json.JSONDecodeError:
    raise ValueError("Environment variable 'ASSEMBLER_PARAMS' contains invalid JSON.")

# === Utility Functions ===

def read_result_files():
    """Reads and returns the content of all files in the results directory as a list of strings."""
    result_files = []
    try:
        for filename in os.listdir(task_results_dir):
            file_path = os.path.join(task_results_dir, filename)
            if os.path.isfile(file_path):
                with open(file_path, "r") as file:
                    result_files.append(file.read())
        return result_files
    except OSError as e:
        raise RuntimeError(f"Error accessing source directory '{task_results_dir}': {e}")
    except Exception as e:
        raise RuntimeError(f"Error reading files in '{task_results_dir}': {e}")

def save_output_file(filename, data):
    """Saves the processed output to the specified file in the output directory."""
    output_path = os.path.join(output_dir, filename)
    try:
        with open(output_path, "w") as outfile:
            outfile.write(data)
        logger.info(f"Saved {filename} to {output_path}")
    except OSError as e:
        raise RuntimeError(f"Error writing to output file '{output_path}': {e}")

def merge_transcripts(result_files_content):
    """Merges transcription JSON content into a combined transcript."""
    transcripts = []
    speaker_map = {}
    
    try:
        for i, file_content in enumerate(result_files_content):
            try:
                transcript_data = json.loads(file_content)
                
                # Generate speaker ID
                speaker_id = f"speaker_{i}"
                speaker_map[speaker_id] = transcript_data.get('text', '')
                
                # Add to combined transcript with speaker identification
                if transcript_data.get('text'):
                    transcripts.append(f"[Speaker: {speaker_id}] {transcript_data['text']}")
                    
            except json.JSONDecodeError as e:
                logger.warning(f"Skipping invalid JSON in file {i}: {e}")
                continue
                        
        combined_text = "\n\n".join(transcripts)
        logger.info(f"Merged {len(transcripts)} transcripts into combined text ({len(combined_text)} characters)")
        return combined_text, speaker_map
        
    except Exception as e:
        logger.error(f"Error merging transcripts: {e}")
        raise RuntimeError(f"Failed to merge transcripts: {e}")

def call_openai_api(messages, model="llama-4-scout"):
    """Makes a direct REST API call to local llama-server (OpenAI-compatible endpoint)."""
    url = "http://localhost:8000/v1/chat/completions"
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': model,
        'messages': messages,
        'temperature': 0.6,
        'max_tokens': 2048
    }
    
    try:
        # Create the request
        req = urllib.request.Request(
            url, 
            json.dumps(data).encode('utf-8'), 
            headers
        )
        
        # Make the request
        with urllib.request.urlopen(req, timeout=120) as response:
            response_data = json.loads(response.read().decode('utf-8'))
            return response_data
            
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"Local LLM API HTTP Error {e.code}: {error_body}")
    except urllib.error.URLError as e:
        raise Exception(f"Local LLM API URL Error: {e.reason}")
    except Exception as e:
        raise Exception(f"Local LLM API Error: {str(e)}")

def extract_decisions_with_openai(combined_text):
    """Uses OpenAI to extract decisions from the combined transcript."""
    try:
        system_prompt = """You are an expert at identifying decisions made during meetings. 
        
        Analyze the transcript and extract any decisions that were made. A decision is:
        - A commitment to take a specific action
        - An agreement on a particular approach or solution
        - A choice between alternatives that was resolved
        - A concrete plan or deadline that was established
        
        Return your response as a JSON array where each decision has:
        - "text": The decision statement (clear and concise)
        - "speakerId": The speaker who made or proposed the decision
        
        If no clear decisions were made, return an empty array.
        
        Example format:
        [
            {"text": "Ship API v2 on June 20th", "speakerId": "speaker_1"},
            {"text": "Upgrade to Node 20 next sprint", "speakerId": "speaker_2"}
        ]"""
        
        user_prompt = f"Please analyze this meeting transcript and extract any decisions:\n\n{combined_text}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        logger.info("Calling local LLM API for decision extraction...")
        response = call_openai_api(messages)
        
        decisions_text = response['choices'][0]['message']['content'].strip()
        logger.info(f"Local LLM response: {decisions_text}")
        
        # Try to parse the JSON response
        try:
            decisions = json.loads(decisions_text)
            if isinstance(decisions, list):
                logger.info(f"Successfully extracted {len(decisions)} decisions from local LLM")
                return decisions
            else:
                logger.warning("Local LLM response was not a list, returning empty decisions")
                return []
        except json.JSONDecodeError:
            logger.warning("Could not parse local LLM response as JSON, returning empty decisions")
            return []
            
    except Exception as e:
        logger.error(f"Local LLM decision extraction failed: {e}")
        logger.info("Returning empty decisions due to local LLM failure")
        return []




# === Main Logic ===

if __name__ == "__main__":
    logger.info("Assembler task started")

    # == Your Code ==

    # 1. Reading Result Files
    # Read any files from the results directory. You can use the read_result_files function to read the content of all files in the results directory.
    logger.info(f"Reading transcription results from: {task_results_dir}")
    
    try:
        result_files_content = read_result_files()
        
        if not result_files_content:
            logger.warning("No transcription result files found")
            # Save empty decision array
            empty_result = {
                "decisions": [],
                "metadata": {
                    "total_transcripts": 0,
                    "processing_method": "none",
                    "status": "no_transcripts_found"
                }
            }
            save_output_file("decisions.json", json.dumps(empty_result, indent=2))
            logger.info("Assembler task completed - no transcripts to process")
            exit(0)
        
        logger.info(f"Found {len(result_files_content)} transcription result files")
    except Exception as e:
        logger.error(f"Error reading result files: {e}")
        raise

    # ------------------------

    # 2. Fanning In Results
    # If necessary, combine or process the results from multiple files.
    logger.info("Merging transcription results...")
    try:
        combined_text, speaker_map = merge_transcripts(result_files_content)
        
        if not combined_text.strip():
            logger.warning("Combined transcript is empty")
            empty_result = {
                "decisions": [],
                "metadata": {
                    "total_transcripts": len(result_files_content),
                    "processing_method": "none",
                    "status": "empty_transcripts"
                }
            }
            save_output_file("decisions.json", json.dumps(empty_result, indent=2))
            logger.info("Assembler task completed - empty transcripts")
            exit(0)
            
    except Exception as e:
        logger.error(f"Error merging transcripts: {e}")
        raise

    # ------------------------
    # 3. Performing Post-Processing Operations
    # Perform any necessary post-processing operations on the combined results.
    logger.info("Extracting decisions using local LLM...")
    try:
        decisions = extract_decisions_with_openai(combined_text)
        
        # Enhance decisions with additional metadata if available
        enhanced_decisions = []
        for decision in decisions:
            enhanced_decision = {
                "text": decision.get("text", ""),
                "speakerId": decision.get("speakerId", "unknown"),
                "confidence": "ai_extracted"  # Could be enhanced with confidence scores
            }
            enhanced_decisions.append(enhanced_decision)
        
        logger.info(f"Successfully extracted {len(enhanced_decisions)} decisions")
        
    except Exception as e:
        logger.error(f"Error extracting decisions: {e}")
        # In case of complete failure, provide fallback
        enhanced_decisions = []

    # ------------------------
    # 4. Saving Final Output
    # Save the final output to the output directory using the save_output_file function.
    logger.info("Saving final decision results...")
    
    # Prepare final output following PRD format with full transcript included
    final_output = {
        "decisions": enhanced_decisions,
        "metadata": {
            "total_transcripts": len(result_files_content),
            "combined_text_length": len(combined_text),
            "processing_method": "local_llm" if enhanced_decisions else "no_decisions",
            "status": "success" if enhanced_decisions else "no_decisions_found",
            "speaker_count": len(speaker_map)
        },
        "raw_transcript_preview": combined_text[:500] + "..." if len(combined_text) > 500 else combined_text,
        "full_transcript": combined_text  # Include full transcript in single output file
    }
    
    # Save as single JSON output file
    output_json = json.dumps(final_output, indent=2, ensure_ascii=False)
    save_output_file("decisions.json", output_json)
    
    logger.info(f"Assembler task completed successfully - found {len(enhanced_decisions)} decisions")

    # -------------------------
