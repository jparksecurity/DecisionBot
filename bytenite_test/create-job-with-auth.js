#!/usr/bin/env node

/**
 * Bytenite Job Creator with Authentication and File Upload
 *
 * This script gets an access token and creates a Bytenite job using file upload for audio transcription.
 *
 * Usage:
 * 1. BYTENITE_API_KEY=your-api-key node create-job-with-auth.js
 * 2. node --env-file=.env create-job-with-auth.js
 */

const fs = require("fs");
const path = require("path");

/**
 * Get access token from Bytenite API
 * @param {string} apiKey - The Bytenite API key
 * @returns {Promise<object>} - Promise resolving to token response
 */
async function getAccessToken(apiKey) {
  const response = await fetch("http://api.bytenite.com/v1/auth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: apiKey,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch {
      errorMessage = errorText;
    }

    throw new Error(`HTTP ${response.status}: ${errorMessage}`);
  }

  return await response.json();
}

/**
 * Create a job with file upload data source
 * @param {string} accessToken - The Bytenite access token
 * @param {string} templateId - Template ID to use
 * @param {string} jobName - Name for the job
 * @returns {Promise<object>} - Promise resolving to job response
 */
async function createJob(accessToken, templateId, jobName) {
  const response = await fetch("http://api.bytenite.com/v1/customer/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: jobName,
      templateId: templateId,
      dataSource: {
        dataSourceDescriptor: "file",
        params: {
          "@type":
            "type.googleapis.com/bytenite.data_source.LocalFileDataSource",
        },
      },
      dataDestination: {
        dataSourceDescriptor: "bucket",
      },
      params: {
        partitioner: {},
        assembler: {},
        app: {},
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch {
      errorMessage = errorText;
    }

    throw new Error(`HTTP ${response.status}: ${errorMessage}`);
  }

  return await response.json();
}

/**
 * Upload file to temporary URL
 * @param {string} tempUrl - Temporary upload URL from job response
 * @param {string} filePath - Path to file to upload
 * @returns {Promise<void>}
 */
async function uploadFile(tempUrl, filePath) {
  const fileBuffer = fs.readFileSync(filePath);

  const response = await fetch(tempUrl, {
    method: "PUT",
    headers: {
      "Content-Disposition": "attachment",
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: HTTP ${response.status}`);
  }
}

/**
 * Notify server that upload is completed
 * @param {string} accessToken - The Bytenite access token
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Promise resolving to completion response
 */
async function notifyUploadCompleted(accessToken, jobId) {
  const response = await fetch(
    `http://api.bytenite.com/v1/customer/jobs/uploadcompleted/${jobId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Upload completion notification failed: HTTP ${response.status}: ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Main function
 */
async function main() {
  try {
    // Get API key from environment variable
    const apiKey = process.env.BYTENITE_API_KEY;

    if (!apiKey) {
      console.error(
        "❌ Error: BYTENITE_API_KEY environment variable is required"
      );
      console.log("Usage:");
      console.log(
        "  1. BYTENITE_API_KEY=your-api-key node create-job-with-auth.js"
      );
      console.log("  2. node --env-file=.env create-job-with-auth.js");
      process.exit(1);
    }

    // Configuration
    const templateId = "decisionbot-transcription";
    const jobName = "Audio Transcription Test Job";
    const audioFile = path.join(
      __dirname,
      "audio-test-data/test-meeting-1749788369/user123.wav"
    );

    // Check if audio file exists
    if (!fs.existsSync(audioFile)) {
      console.error(`❌ Error: Audio file not found: ${audioFile}`);
      process.exit(1);
    }

    // Step 1: Get access token
    console.log("🔑 Getting access token from Bytenite...");
    const tokenResponse = await getAccessToken(apiKey);
    const accessToken = tokenResponse.token;

    console.log(`🕒 Access token: ${accessToken}`);
    console.log(`🕒 Expires in: ${tokenResponse.expiresIn} seconds`);
    console.log(`📊 Scope: ${tokenResponse.scope || "N/A"}`);

    // Step 2: Create job with file data source
    console.log("\n🚀 Creating Bytenite job...");
    console.log(`📁 Using audio file: ${audioFile}`);
    console.log(`📋 Template: ${templateId}`);

    const jobResponse = await createJob(accessToken, templateId, jobName);
    const jobId = jobResponse.job.id;
    const tempUrl = jobResponse.job.dataSource.params.tempUrl;

    console.log(`✅ Job created successfully!`);
    console.log(`🆔 Job ID: ${jobId}`);
    console.log(`🔗 Upload URL: ${tempUrl}`);

    // Step 3: Upload the audio file
    console.log("\n📤 Uploading audio file...");
    await uploadFile(tempUrl, audioFile);
    console.log("✅ File uploaded successfully!");

    // Step 4: Notify server that upload is completed
    console.log("📢 Notifying server of upload completion...");
    await notifyUploadCompleted(accessToken, jobId);
    console.log("✅ Upload completion notified!");

    console.log("\n🎉 Complete workflow finished successfully!");
    console.log("\n📋 Final Job Details:");
    console.log(`Job ID: ${jobId}`);
    console.log(`Template: ${templateId}`);
    console.log(`Name: ${jobName}`);
    console.log(`Audio File: ${path.basename(audioFile)}`);
    console.log(`State: ${jobResponse.job.state}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  getAccessToken,
  createJob,
  uploadFile,
  notifyUploadCompleted,
};
