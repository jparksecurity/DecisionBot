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
  const response = await fetch("https://api.bytenite.com/v1/auth/access_token", {
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
  const response = await fetch("https://api.bytenite.com/v1/customer/jobs", {
    method: "POST",
    headers: {
      Authorization: accessToken,
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
    `https://api.bytenite.com/v1/customer/jobs/${jobId}/uploadcompleted`,
    {
      method: "PATCH",
      headers: {
        Authorization: accessToken,
        "Accept": "*/*"
      }
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
 * Run the job
 * @param {string} accessToken - The Bytenite access token
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Promise resolving to run response
 */
async function runJob(accessToken, jobId) {
  const response = await fetch(
    `https://api.bytenite.com/v1/customer/jobs/${jobId}/run`,
    {
      method: "POST",
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: {
          taskTimeout: 1,
          jobTimeout: 1,
          isTestJob: true
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Job run failed: HTTP ${response.status}: ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Get job status
 * @param {string} accessToken - The Bytenite access token
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Promise resolving to job status response
 */
async function getJobStatus(accessToken, jobId) {
  const response = await fetch(
    `https://api.bytenite.com/v1/customer/jobs/${jobId}`,
    {
      method: "GET",
      headers: {
        Authorization: accessToken,
        "Accept": "*/*"
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Get job status failed: HTTP ${response.status}: ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Get job logs
 * @param {string} accessToken - The Bytenite access token
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Promise resolving to job logs response
 */
async function getJobLogs(accessToken, jobId) {
  const response = await fetch("https://api.bytenite.com/v1/customer/logs", {
    method: "POST",
    headers: {
      Authorization: accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jobId: jobId,
      taskIds: [jobId], // Using jobId as taskId for now
      levels: ["UNKNOWN", "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "PANIC"],
      services: ["PARTITIONER", "ASSEMBLER", "APP"]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Get job logs failed: HTTP ${response.status}: ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Display job logs in a formatted way
 * @param {object} logsResponse - The logs response from the API
 */
function displayJobLogs(logsResponse) {
  console.log("\n📋 Job Logs:");
  console.log("=" * 50);
  
  // Display logs for each service
  for (const [service, logs] of Object.entries(logsResponse)) {
    if (service === "taskrunner") {
      // Handle taskrunner logs which have a different structure
      console.log(`\n🔧 ${service.toUpperCase()}:`);
      for (const [taskId, taskData] of Object.entries(logs)) {
        console.log(`  Task: ${taskId}`);
        if (taskData.logs && Array.isArray(taskData.logs)) {
          taskData.logs.forEach(logEntry => {
            const timestamp = new Date(logEntry.timestamp).toLocaleString();
            const level = logEntry.level.padEnd(5);
            console.log(`    [${timestamp}] ${level} | ${logEntry.log}`);
          });
        }
      }
    } else if (Array.isArray(logs)) {
      // Handle partitioner and assembler logs
      console.log(`\n🔧 ${service.toUpperCase()}:`);
      logs.forEach(logEntry => {
        const timestamp = new Date(logEntry.timestamp).toLocaleString();
        const level = logEntry.level.padEnd(5);
        console.log(`  [${timestamp}] ${level} | ${logEntry.log}`);
      });
    }
  }
  console.log("=" * 50);
}

/**
 * Poll job status until completion
 * @param {string} accessToken - The Bytenite access token
 * @param {string} jobId - Job ID
 * @param {number} pollIntervalMs - Polling interval in milliseconds (default: 5000)
 * @returns {Promise<object>} - Promise resolving to final job status
 */
async function pollJobStatus(accessToken, jobId, pollIntervalMs = 5000) {
  console.log("⏳ Polling job status...");
  
  while (true) {
    const statusResponse = await getJobStatus(accessToken, jobId);
    const jobState = statusResponse.job.state;
    
    console.log(`📊 Current job state: ${jobState}`);
    
    if (jobState === "JOB_STATE_COMPLETE") {
      console.log("✅ Job completed successfully!");
      return statusResponse;
    } else if (jobState === "JOB_STATE_FAILED") {
      console.log("❌ Job failed!");
      if (statusResponse.job.errorMessage) {
        console.log(`Error: ${statusResponse.job.errorMessage}`);
      }
      
      // Fetch and display job logs for debugging
      try {
        console.log("🔍 Fetching job logs for debugging...");
        const logsResponse = await getJobLogs(accessToken, jobId);
        displayJobLogs(logsResponse);
      } catch (logError) {
        console.error("⚠️  Failed to fetch job logs:", logError.message);
      }
      
      return statusResponse;
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
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
    const jobName = "Audio Transcription Test Job (Multiple Files)";
    const audioFile = path.join(
      __dirname,
      "audio-test-data/test-meeting-1749788369/test-meeting-audio-files.zip"
    );

    // Check if audio file exists
    if (!fs.existsSync(audioFile)) {
      console.error(`❌ Error: Audio zip file not found: ${audioFile}`);
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
    console.log(`📁 Using audio zip file: ${audioFile}`);
    console.log(`📋 Template: ${templateId}`);

    const jobResponse = await createJob(accessToken, templateId, jobName);
    const jobId = jobResponse.job.id;
    const tempUrl = jobResponse.job.dataSource.params.tempUrl;

    console.log(`✅ Job created successfully!`);
    console.log(`🆔 Job ID: ${jobId}`);
    console.log(`🔗 Upload URL: ${tempUrl}`);

    // Step 3: Upload the audio zip file
    console.log("\n📤 Uploading audio zip file...");
    await uploadFile(tempUrl, audioFile);
    console.log("✅ Zip file uploaded successfully!");

    // Step 4: Notify server that upload is completed
    console.log("📢 Notifying server of upload completion...");
    await notifyUploadCompleted(accessToken, jobId);
    console.log("✅ Upload completion notified!");

    // Step 5: Run the job
    console.log("\n🏃 Running the job...");
    const runResponse = await runJob(accessToken, jobId);
    console.log("✅ Job started successfully!");

    // Step 6: Poll job status until completion
    console.log("\n⏳ Waiting for job completion...");
    const finalStatus = await pollJobStatus(accessToken, jobId);

    console.log("\n🎉 Complete workflow finished successfully!");
    console.log("\n📋 Final Job Details:");
    console.log(`Job ID: ${jobId}`);
    console.log(`Template: ${templateId}`);
    console.log(`Name: ${jobName}`);
    console.log(`Audio Zip File: ${path.basename(audioFile)}`);
    console.log(`Final State: ${finalStatus.job.state}`);
    
    if (finalStatus.job.endedAt) {
      console.log(`Ended At: ${finalStatus.job.endedAt}`);
    }
    if (finalStatus.job.duration) {
      console.log(`Duration: ${finalStatus.job.duration} seconds`);
    }
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
  runJob,
  getJobStatus,
  getJobLogs,
  pollJobStatus,
};
