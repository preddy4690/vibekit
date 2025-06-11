# Temporal Migration Guide

This document outlines the migration from Inngest to Temporal SDK for workflow management in the Codex Clone application.

## Overview

The application has been successfully migrated from Inngest to Temporal for handling:
- Task creation and execution workflows
- Real-time status updates
- Event publishing and subscription

## Architecture

### Temporal Components

1. **Workflows** (`lib/workflows.ts`)
   - `createTaskWorkflow`: Main workflow that replaces the Inngest `createTask` function
   - Handles task execution lifecycle from start to completion

2. **Activities** (`lib/activities.ts`)
   - `generateCode`: Executes VibeKit code generation
   - `publishTaskStatus`: Publishes task status updates via BroadcastChannel
   - `publishTaskUpdate`: Publishes real-time task updates via BroadcastChannel

3. **Client Setup** (`lib/temporal.ts`)
   - Temporal client configuration
   - Worker setup for development environment
   - Connection management

4. **API Routes** (`app/api/temporal/route.ts`)
   - Replaces the Inngest API route
   - Handles workflow execution requests
   - Provides workflow status endpoints

### Real-time Updates

The application uses BroadcastChannel for real-time communication:
- **Status Channel**: `task-status` - for task status changes (IN_PROGRESS, DONE, MERGED)
- **Update Channel**: `task-update` - for real-time progress updates during execution

### Client-side Integration

1. **useTemporalSubscription Hook** (`hooks/useTemporalSubscription.ts`)
   - Replaces `useInngestSubscription`
   - Listens to BroadcastChannel messages
   - Provides real-time updates to React components

2. **Actions** (`app/actions/temporal.ts`)
   - `createTaskAction`: Starts Temporal workflows
   - `getTemporalSubscriptionToken`: Provides subscription tokens

## Environment Setup

### Required Environment Variables

```bash
# Temporal Server Configuration
TEMPORAL_ADDRESS=localhost:7233  # Default Temporal server address

# Existing VibeKit Configuration
OPENAI_API_KEY=your_openai_key
E2B_API_KEY=your_e2b_key
```

**Note**: The application uses Temporal's `default` namespace, which is automatically available when running `temporal server start-dev`.

### Running Temporal Server

1. Install Temporal CLI:
   ```bash
   brew install temporal
   ```

2. Start Temporal server:
   ```bash
   temporal server start-dev
   ```

3. Start the Temporal worker (in a separate terminal):
   ```bash
   cd examples/codex-clone
   npm run worker
   ```

   Or alternatively, from the root directory:
   ```bash
   npx tsx examples/codex-clone/scripts/worker.ts
   ```

4. Start the application:
   ```bash
   npm run dev
   ```

## Key Changes Made

### Removed Files
- `lib/inngest.ts` - Inngest configuration and functions
- `app/api/inngest/route.ts` - Inngest API route
- `app/actions/inngest.ts` - Inngest actions

### Removed Dependencies
- `inngest` - Main Inngest SDK
- `@inngest/realtime` - Inngest real-time functionality

### Updated Files
- `app/_components/task-form.tsx` - Uses Temporal actions
- `app/task/[id]/client-page.tsx` - Uses Temporal subscription
- `app/container.tsx` - Uses Temporal subscription
- `package.json` - Removed Inngest dependencies

## Benefits of Temporal

1. **Durability**: Workflows survive process restarts and failures
2. **Visibility**: Built-in workflow execution history and debugging
3. **Scalability**: Better handling of long-running workflows
4. **Reliability**: Automatic retries and error handling
5. **Versioning**: Support for workflow versioning and migration

## Development Workflow

1. Start Temporal server: `temporal server start-dev`
2. Start the Temporal worker: `cd examples/codex-clone && npm run worker`
3. Start the application: `cd examples/codex-clone && npm run dev`
4. Create tasks through the UI
5. Monitor workflows in Temporal Web UI: `http://localhost:8233`

### New Scripts Added

- `npm run worker` - Starts the Temporal worker to process workflows

## Troubleshooting

### Common Issues

1. **Temporal server not running**
   - Ensure Temporal server is started with `temporal server start-dev`
   - Check connection at `http://localhost:8233`

2. **Worker not starting**
   - Check console for worker startup messages
   - Ensure activities and workflows are properly exported

3. **Real-time updates not working**
   - Verify BroadcastChannel support in browser
   - Check browser console for subscription errors

### Monitoring

- Temporal Web UI: `http://localhost:8233`
- Workflow execution history
- Task queue monitoring
- Worker status

## Migration Checklist

- [x] Remove Inngest dependencies
- [x] Implement Temporal workflows and activities
- [x] Update client-side subscription mechanism
- [x] Replace API routes
- [x] Update component imports
- [x] Test task creation and execution
- [x] Verify real-time updates
- [x] Clean up build artifacts

The migration is complete and the application now uses Temporal for all workflow management while maintaining the same user experience and functionality.
