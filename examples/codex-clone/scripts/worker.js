#!/usr/bin/env node

// Register ts-node to handle TypeScript files
require('ts-node/register');

const { config } = require('dotenv');
const { resolve } = require('path');
const { Worker } = require('@temporalio/worker');

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

// Import TypeScript modules
const activities = require('../lib/activities');

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('../lib/workflows'),
    activities,
    taskQueue: 'codex-clone',
  });

  console.log('Starting Temporal worker...');
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
