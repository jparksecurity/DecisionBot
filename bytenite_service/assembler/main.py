#!/usr/bin/env python3
"""
Decision Extractor Assembler for ByteNite
Collects transcripts, combines them, and calls GMI Cloud for decision extraction
"""

import os
import sys
import json
import re
from pathlib import Path

def install_requirements():
    """Install required packages if not available"""
    try:
        import requests
    except ImportError:
        print("Installing required packages...")
        os.system("pip install requests")
        import requests

def merge_transcripts(input_dir):
    """
    Merge all transcript JSON files from the input directory.
    Returns a combined transcript with speaker information.
    """
    input_path = Path(input_dir)
    merged_transcripts = []
    
    if not input_path.exists():
        print(f"Warning: Input directory {input_dir} does not exist")
        return merged_transcripts
    
    # Find all JSON files (transcription results)
    json_files = list(input_path.glob("*.json"))
    print(f"Found {len(json_files)} transcript files to merge")
    
    for json_file in json_files:
        try:
            with open(json_file, 'r') as f:
                transcript_data = json.load(f)
            
            # Extract text and speaker information
            if isinstance(transcript_data, dict) and 'text' in transcript_data:
                # Try to get user_id from the original chunk metadata
                # Look for corresponding chunk file or extract from filename
                user_id = extract_user_id_from_filename(json_file.name)
                
                merged_transcripts.append({
                    "user_id": user_id,
                    "text": transcript_data['text'].strip(),
                    "language": transcript_data.get('language', 'unknown'),
                    "segments": transcript_data.get('segments', [])
                })
                
                print(f"Merged transcript from {json_file.name} (user: {user_id})")
            
        except Exception as e:
            print(f"Error processing {json_file}: {e}")
    
    return merged_transcripts

def extract_user_id_from_filename(filename):
    """Extract user ID from filename, handling various patterns"""
    # Remove .json extension and common prefixes
    base_name = filename.replace('.json', '')
    
    # Try different patterns
    
    # Pattern 1: output_userXXX or result_userXXX -> userXXX
    if base_name.startswith('output_') or base_name.startswith('result_'):
        prefix_removed = base_name.split('_', 1)[1] if '_' in base_name else base_name
        return prefix_removed
    
    # Pattern 2: userXXX.json -> userXXX (direct match)
    if base_name.startswith('user') and not base_name.startswith('user_'):
        return base_name
    
    # Pattern 3: chunk_0001 -> user_0001 (chunk pattern)
    if base_name.startswith('chunk_'):
        number_part = base_name.split('_')[1] if '_' in base_name else '0'
        return f"user_{number_part}"
    
    # Pattern 4: pure numbers -> user_XXX
    if base_name.isdigit():
        return f"user_{base_name}"
    
    # Pattern 5: contains numbers -> extract first number sequence
    match = re.search(r'(\d+)', base_name)
    if match:
        return f"user_{match.group(1)}"
    
    # Default fallback - return as is
    return base_name or "unknown_user"

def call_gmi_cloud(combined_text, api_key=None):
    """
    Call GMI Cloud decision-extractor-v1 service.
    Returns a list of decision candidates.
    """
    import requests
    
    if not api_key:
        api_key = os.getenv("GMI_API_KEY")
    
    if not api_key:
        raise ValueError("GMI_API_KEY environment variable is required")
    
    # GMI Cloud API endpoint (based on documentation)
    url = "https://api.gmicloud.ai/v1/chat/completions"
    
    # Construct the decision extraction prompt
    prompt = f"""
Please analyze the following meeting transcript and extract any decisions that were made. 
For each decision, provide:
1. The exact decision text
2. The speaker who made or confirmed the decision (if identifiable)

Transcript:
{combined_text}

Please respond with a JSON array of decisions in this format:
[{{"text": "decision text", "speaker_id": "user_123"}}]

If no decisions were made, return an empty array: []
"""

    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-ai/DeepSeek-R1",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 2000,
        "temperature": 0.3,
        "response_format": {"type": "json_object"}
    }
    
    print("Calling GMI Cloud for decision extraction...")
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # Parse the JSON response
        decisions = json.loads(content)
        
        # Ensure it's a list
        if not isinstance(decisions, list):
            decisions = []
        
        print(f"GMI Cloud returned {len(decisions)} decisions")
        return decisions
        
    except requests.exceptions.RequestException as e:
        print(f"GMI Cloud API error: {e}")
        raise
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing GMI Cloud response: {e}")
        raise

def regex_fallback(combined_text):
    """
    Fallback decision extraction using regex patterns.
    Used when GMI Cloud is unavailable.
    """
    print("Using regex fallback for decision extraction...")
    
    # Common decision-making phrases
    decision_patterns = [
        r"we (?:will|shall|should|are going to|decided to|agree to) ([^.!?]+)",
        r"let's ([^.!?]+)",
        r"(?:decision|decided|agree[d]?|commit[ted]?)(?: is| was)?:?\s*([^.!?]+)",
        r"we're (?:going to|gonna) ([^.!?]+)",
        r"I (?:will|shall) ([^.!?]+)",
        r"(?:plan|planning) (?:is |to )?([^.!?]+)",
    ]
    
    decisions = []
    
    for pattern in decision_patterns:
        matches = re.finditer(pattern, combined_text, re.IGNORECASE)
        for match in matches:
            decision_text = match.group(1).strip()
            if len(decision_text) > 10:  # Filter out very short matches
                decisions.append({
                    "text": decision_text,
                    "speaker_id": "unknown",
                    "extracted_by": "regex_fallback"
                })
    
    # Remove duplicates
    unique_decisions = []
    seen_texts = set()
    for decision in decisions:
        if decision["text"].lower() not in seen_texts:
            seen_texts.add(decision["text"].lower())
            unique_decisions.append(decision)
    
    print(f"Regex fallback found {len(unique_decisions)} potential decisions")
    return unique_decisions

def process_transcripts(input_dir, output_file):
    """
    Main processing function: merge transcripts, extract decisions, save results.
    """
    # Merge all transcripts
    transcripts = merge_transcripts(input_dir)
    
    if not transcripts:
        print("No transcripts found to process")
        result = {"decisions": [], "message": "No transcripts found"}
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        return result
    
    # Combine all transcript text
    combined_text = "\n\n".join([
        f"Speaker {t['user_id']}: {t['text']}" 
        for t in transcripts
    ])
    
    print(f"Combined transcript length: {len(combined_text)} characters")
    
    try:
        # Try GMI Cloud first
        decisions = call_gmi_cloud(combined_text)
        extraction_method = "gmi_cloud"
    except Exception as e:
        print(f"GMI Cloud failed: {e}")
        # Fall back to regex
        decisions = regex_fallback(combined_text)
        extraction_method = "regex_fallback"
    
    # Prepare final result
    result = {
        "decisions": decisions,
        "extraction_method": extraction_method,
        "transcript_count": len(transcripts),
        "participants": [t['user_id'] for t in transcripts]
    }
    
    # Save result
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"✅ Saved {len(decisions)} decisions to {output_file}")
    return result

def main():
    """Main entry point for ByteNite assembler"""
    # Install requirements
    install_requirements()
    
    # Get input and output from environment variables
    input_dir = os.getenv("INPUT_DIR", "/input")
    output_file = os.getenv("OUTPUT_FILE", "/output/decisions.json")
    
    # Also support command line arguments for testing
    if len(sys.argv) >= 2:
        input_dir = sys.argv[1]
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]
    
    print(f"Decision Extractor Assembler starting...")
    print(f"Input directory: {input_dir}")
    print(f"Output file: {output_file}")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    try:
        result = process_transcripts(input_dir, output_file)
        print(f"✅ Successfully processed transcripts and extracted decisions")
        return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    exit(main()) 