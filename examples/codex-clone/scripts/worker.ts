#!/usr/bin/env tsx

import { Worker } from '@temporalio/worker';
import * as activities from '../lib/activities';

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
