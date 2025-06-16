#!/usr/bin/env node

/**
 * Bytenite Job Logs Retriever
 *
 * This script gets job logs from a specific Bytenite job.
 *
 * Usage:
 * 1. BYTENITE_API_KEY=your-api-key node get-job-logs.js <job-id>
 * 2. node --env-file=.env get-job-logs.js <job-id>
 */

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
      taskIds: [],
      levels: [],
      services: []
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
  console.log("=".repeat(50));
  
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
  console.log("=".repeat(50));
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
        "  1. BYTENITE_API_KEY=your-api-key node get-job-logs.js <job-id>"
      );
      console.log("  2. node --env-file=.env get-job-logs.js <job-id>");
      process.exit(1);
    }

    // Get job ID from command line arguments
    const jobId = process.argv[2];
    if (!jobId) {
      console.error("❌ Error: Job ID is required as a command line argument");
      console.log("Usage:");
      console.log(
        "  1. BYTENITE_API_KEY=your-api-key node get-job-logs.js <job-id>"
      );
      console.log("  2. node --env-file=.env get-job-logs.js <job-id>");
      process.exit(1);
    }

    console.log(`🔍 Fetching logs for job: ${jobId}`);

    // Step 1: Get access token
    console.log("🔑 Getting access token from Bytenite...");
    const tokenResponse = await getAccessToken(apiKey);
    const accessToken = tokenResponse.token;

    console.log("✅ Access token obtained successfully");

    // Step 2: Get job status first
    console.log("📊 Getting job status...");
    const statusResponse = await getJobStatus(accessToken, jobId);
    const jobState = statusResponse.job.state;
    const jobName = statusResponse.job.name;

    console.log(`📋 Job Name: ${jobName}`);
    console.log(`📊 Current State: ${jobState}`);
    if (statusResponse.job.createdAt) {
      console.log(`🕒 Created: ${new Date(statusResponse.job.createdAt).toLocaleString()}`);
    }
    if (statusResponse.job.startedAt) {
      console.log(`🚀 Started: ${new Date(statusResponse.job.startedAt).toLocaleString()}`);
    }
    if (statusResponse.job.endedAt) {
      console.log(`🏁 Ended: ${new Date(statusResponse.job.endedAt).toLocaleString()}`);
    }

    // Step 3: Get job logs
    console.log("\n🔍 Fetching job logs...");
    const logsResponse = await getJobLogs(accessToken, jobId);

    // Step 4: Display logs
    displayJobLogs(logsResponse);

    // Step 5: Also display raw JSON for debugging
    // console.log("\n🔧 Raw Logs JSON (for debugging):");
    // console.log(JSON.stringify(logsResponse, null, 2));

    console.log("\n✅ Job logs retrieved successfully!");

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
  getJobLogs,
  getJobStatus,
  displayJobLogs,
}; 