import os
import time
import requests

# Constants
API_BASE_URL = "https://api.bytenite.com/v1"
AUDIO_FILE_URL = "https://storage.googleapis.com/video-test-public/temp.mp3"  # Replace with your audio file URL

def get_api_key():
    api_key = os.getenv('BYTENITE_API_KEY')
    if not api_key:
        raise ValueError("BYTENITE_API_KEY environment variable is not set.")
    return api_key

def get_access_token(api_key):
    url = f"{API_BASE_URL}/auth/access_token"
    response = requests.post(url, json={"apiKey": api_key})
    response.raise_for_status()
    return response.json()['token']

def create_job(access_token):
    url = f"{API_BASE_URL}/customer/jobs"
    job_payload = {
        "name": "Audio transcription job",
        "templateId": "transcription-service-template",
        "description": "Transcribe an audio file to text using whisper AI.",
        "dataSource": {
            "dataSourceDescriptor": "url",
            "params": {
                "@type": "type.googleapis.com/bytenite.data_source.HttpDataSource",
                "url": AUDIO_FILE_URL
            }
        },
        "dataDestination": {
            "dataSourceDescriptor": "bucket"
        },
        "params": {
            "partitioner": {},
            "assembler": {},
            "app": {}
        },
        "config": {
            "taskTimeout": "3600",
            "jobTimeout": "84200",
            "isTestJob": True
        }
    }
    headers = {'Authorization': access_token}
    response = requests.post(url, json=job_payload, headers=headers)
    response.raise_for_status()
    return response.json()['job']['id']

def launch_job(job_id, access_token):
    url = f"{API_BASE_URL}/customer/jobs/{job_id}/run"
    headers = {'Authorization': access_token}
    response = requests.post(url, headers=headers)
    response.raise_for_status()

def poll_job_status(job_id, access_token):
    url = f"{API_BASE_URL}/customer/jobs/{job_id}"
    headers = {'Authorization': access_token}
    print(f"Monitoring job status for job ID: {job_id}")
    while True:
        time.sleep(10)
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        job_status = response.json()['job']['state']
        if job_status == 'JOB_STATE_COMPLETE':
            break

def fetch_job_results(job_id, access_token):
    url = f"{API_BASE_URL}/customer/jobs/{job_id}/results"
    headers = {'Authorization': access_token}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json().get('results', [])

def main():
    api_key = get_api_key()
    access_token = get_access_token(api_key)
    job_id = create_job(access_token)
    print(f"Created job with ID: {job_id}")
    launch_job(job_id, access_token)
    print(f"Launched job with ID: {job_id}")
    poll_job_status(job_id, access_token)
    print(f"Job {job_id} completed!")
    results = fetch_job_results(job_id, access_token)
    print("Job Results:")
    for result in results:
        print(result)

if __name__ == "__main__":
    main()
