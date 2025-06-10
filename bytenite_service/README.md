# 1. Build a Docker image with Dockerfile

We used the Dockerfile in this folder to build an image which we pushed to `bytenite/transcription-service:latest`.
From Mac, we used buildx to accomplish this:

```
docker buildx build --platform linux/amd64 -t bytenite/bytenite-transcriber:latest --push .
```

You can use this Dockerfile to build and push your own image, or simply use `bytenite/bytenite-transcriber:latest`

# ByteNite App: `transcription-service`

In order to run the transcription-service app, first upload it to your account.

```
bytenite auth
```

```
bytenite app push bytenite_service/transcription-service      
```

```
bytenite app activate bytenite_service/transcription-service      
```

# Run jobs with `transcription-service-template`

We set up a handy Postman collection to run jobs with this newly created template. 

[Go to Postman Collection "ByteNite API Demos/Demo: Job with transcription-service-template"](https://www.postman.com/bytenite-team/workspace/bytenite-api-demos/collection/36285584-2adc23ee-2f1a-4675-9c90-37a5e0802464?action=share&creator=36285584&active-environment=36285584-29ed148e-d761-4e24-9d58-0175af333612)

Simply set up the collection with your credentials (`apiKey` variable) to test the audio transcription job.