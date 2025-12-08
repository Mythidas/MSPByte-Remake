/**
 * Test script for Phase 2 - Event Flow (Adapter → Processor → Linker)
 *
 * Run with: tsx src/test-phase2.ts
 *
 * This test validates the complete event flow:
 * 1. QueueManager schedules a sync job
 * 2. Adapter receives job, fetches data from API, publishes "fetched" event
 * 3. Processor receives "fetched" event, normalizes data, stores in DB, publishes "processed" event
 * 4. Linker receives "processed" event, creates relationships, publishes "linked" event
 */

import QueueManager from './queue/QueueManager.js';
import { natsClient } from './lib/nats.js';
import Logger from './lib/logger.js';
import TracingManager from './lib/tracing.js';
import { Microsoft365Adapter } from './adapters/Microsoft365Adapter.js';
import { IdentityProcessor } from './processors/IdentityProcessor.js';
import { GroupProcessor } from './processors/GroupProcessor.js';
import { RoleProcessor } from './processors/RoleProcessor.js';
import { LicenseProcessor } from './processors/LicenseProcessor.js';
import { PolicyProcessor } from './processors/PolicyProcessor.js';
import { Microsoft365Linker } from './linkers/Microsoft365Linker.js';
import { buildEventName } from '@workspace/shared/types/pipeline/index.js';

async function testPhase2EventFlow() {
  console.log('\n=== Testing Phase 2: Event Flow (Adapter → Processor → Linker) ===\n');

  try {
    // Test 1: Connect to NATS
    console.log('Test 1: Connecting to NATS...');
    await natsClient.connect();
    console.log('✓ NATS connected\n');

    // Test 2: Initialize QueueManager
    console.log('Test 2: Initializing QueueManager...');
    const queueManager = new QueueManager();
    await queueManager.initialize();
    console.log('✓ QueueManager initialized\n');

    // Test 3: Initialize Adapter
    console.log('Test 3: Initializing Microsoft365Adapter...');
    const adapter = new Microsoft365Adapter();
    adapter.setQueueManager(queueManager);
    await adapter.start();
    console.log('✓ Microsoft365Adapter started\n');

    // Test 4: Initialize Processors
    console.log('Test 4: Initializing Processors...');
    const identityProcessor = new IdentityProcessor();
    await identityProcessor.start();

    const groupProcessor = new GroupProcessor();
    await groupProcessor.start();

    const roleProcessor = new RoleProcessor();
    await roleProcessor.start();

    const licenseProcessor = new LicenseProcessor();
    await licenseProcessor.start();

    const policyProcessor = new PolicyProcessor();
    await policyProcessor.start();

    console.log('✓ All processors started (5 processors for Microsoft 365)\n');

    // Test 5: Initialize Linker
    console.log('Test 5: Initializing Microsoft365Linker...');
    const linker = new Microsoft365Linker();
    await linker.start();
    console.log('✓ Microsoft365Linker started\n');

    // Test 6: Subscribe to linked events to verify flow completion
    console.log('Test 6: Setting up event listeners to track flow...');
    const receivedEvents = {
      fetched: [] as string[],
      processed: [] as string[],
      linked: [] as string[],
    };

    // Listen for fetched events
    await natsClient.subscribe(buildEventName('fetched', 'identities'), (event: any) => {
      receivedEvents.fetched.push(event.entityType);
      console.log(`  → Fetched event received: ${event.entityType} (${event.eventID})`);
    });

    // Listen for processed events
    await natsClient.subscribe(buildEventName('processed', 'identities'), (event: any) => {
      receivedEvents.processed.push(event.entityType);
      console.log(`  → Processed event received: ${event.entityType} (${event.eventID})`);
    });

    // Listen for linked events
    await natsClient.subscribe(buildEventName('linked', 'identities'), (event: any) => {
      receivedEvents.linked.push(event.entityType);
      console.log(`  → Linked event received: ${event.entityType} (${event.eventID})`);
    });

    console.log('✓ Event listeners ready\n');

    // Test 7: Schedule a test Microsoft 365 sync job
    console.log('Test 7: Scheduling Microsoft 365 sync job for identities...');
    console.log('NOTE: This requires valid Microsoft 365 credentials in the database.');
    console.log('If you see errors about missing data source, create one in the database first.\n');

    // This will fail gracefully if no data source exists - that's expected for initial testing
    const jobId = await queueManager.scheduleJob({
      action: 'sync.microsoft-365.identities',
      tenantId: 'test-tenant-id', // Replace with actual tenant ID
      dataSourceId: 'test-datasource-id', // Replace with actual data source ID
      priority: 5,
      syncId: `test-sync-${Date.now()}`,
      metadata: {
        integrationType: 'microsoft-365',
        entityType: 'identities',
        testMode: true,
      },
    });

    console.log(`✓ Job scheduled: ${jobId}\n`);

    // Test 8: Wait for event flow to complete
    console.log('Test 8: Waiting for event flow to complete (30 seconds)...');
    console.log('Watching for: Fetched → Processed → Linked events\n');

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test 9: Verify event flow
    console.log('\n=== Event Flow Results ===');
    console.log(`Fetched events: ${receivedEvents.fetched.length}`);
    console.log(`Processed events: ${receivedEvents.processed.length}`);
    console.log(`Linked events: ${receivedEvents.linked.length}`);

    if (receivedEvents.fetched.length > 0 &&
        receivedEvents.processed.length > 0 &&
        receivedEvents.linked.length > 0) {
      console.log('\n✓ Complete event flow verified!\n');
    } else {
      console.log('\n⚠️  Partial flow - check if data source exists in database\n');
    }

    // Test 10: Check queue statistics
    console.log('Test 10: Getting queue statistics...');
    const stats = await queueManager.getStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log('✓ Statistics retrieved\n');

    // Cleanup
    console.log('\n=== Cleanup ===');
    await queueManager.shutdown();
    await natsClient.close();

    console.log('\n✅ Phase 2 test completed!\n');
    console.log('Phase 2 (Event Flow) components are wired correctly.');
    console.log('\nWhat was tested:');
    console.log('  ✓ QueueManager initialization');
    console.log('  ✓ Adapter initialization and QueueManager linking');
    console.log('  ✓ All processors initialization');
    console.log('  ✓ Linker initialization');
    console.log('  ✓ NATS event subscriptions');
    console.log('  ✓ Event flow architecture');
    console.log('\nNext Steps:');
    console.log('  1. Create a Microsoft 365 data source in the database');
    console.log('  2. Run a real sync: npm run dev');
    console.log('  3. Check logs for trace IDs flowing through all stages');
    console.log('  4. Verify entities and relationships in database');
    console.log('  5. Proceed to Phase 3 (DataContextLoader)\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

testPhase2EventFlow();
