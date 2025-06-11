import { Connection, Client } from '@temporalio/client';

// Create a Temporal client
let client: Client | undefined;

export const getTemporalClient = async () => {
  if (client) return client;

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  client = new Client({
    connection,
    namespace: 'default',
  });

  return client;
};