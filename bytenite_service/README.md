# Build the Docker Image

Use the provided Dockerfile to build and push the image to Docker Hub. For Mac (using `buildx`):

```sh
docker buildx build --platform linux/amd64 -t <repo/tag> --push .
```

You can use the published image `bytenite/bytenite-transcriber:latest` or build your own.

# ByteNite App: `transcription-service`

To deploy the transcription-service app:

1. Authenticate with ByteNite:
    ```sh
    bytenite auth
    ```

2. Push the app:
    ```sh
    bytenite app push bytenite_service/transcription-service
    ```

3. Activate the app:
    ```sh
    bytenite app activate bytenite_service/transcription-service
    ```

# Running Jobs with `transcription-service-template`

A Postman collection is available to help you run jobs using this template.

[ByteNite API Demos: Job with transcription-service-template (Postman Collection)](https://www.postman.com/bytenite-team/workspace/bytenite-api-demos/collection/36285584-2adc23ee-2f1a-4675-9c90-37a5e0802464?action=share&creator=36285584&active-environment=36285584-29ed148e-d761-4e24-9d58-0175af333612)

Set the `apiKey` variable in the collection to your credentials to test audio transcription jobs.