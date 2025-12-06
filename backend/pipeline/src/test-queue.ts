/**
 * Test script for Phase 1 - Queue Infrastructure
 *
 * Run with: npm run test:queue
 */

import QueueManager from './queue/QueueManager.js';
import { natsClient } from './lib/nats.js';
import Logger from './lib/logger.js';

async function testQueueInfrastructure() {
  console.log('\n=== Testing Phase 1: Queue Infrastructure ===\n');

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

    // Test 3: Health check
    console.log('Test 3: Running health check...');
    const health = await queueManager.healthCheck();
    console.log('Health:', JSON.stringify(health, null, 2));

    if (!health.healthy) {
      throw new Error('Health check failed');
    }
    console.log('✓ Health check passed\n');

    // Test 4: Schedule a test job
    console.log('Test 4: Scheduling test job...');
    const jobId = await queueManager.scheduleJob({
      action: 'test.job',
      tenantId: 'test-tenant',
      dataSourceId: 'test-datasource',
      priority: 5,
      syncId: 'test-sync-001',
      metadata: {
        test: true,
      },
    });
    console.log(`✓ Job scheduled: ${jobId}\n`);

    // Test 5: Check job status
    console.log('Test 5: Checking job status...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s

    const status = await queueManager.getJobStatus(jobId);
    console.log('Job status:', JSON.stringify(status, null, 2));
    console.log('✓ Job status retrieved\n');

    // Test 6: Queue statistics
    console.log('Test 6: Getting queue statistics...');
    const stats = await queueManager.getStats();
    console.log('Queue stats:', JSON.stringify(stats, null, 2));
    console.log('✓ Statistics retrieved\n');

    // Test 7: Schedule recurring job
    console.log('Test 7: Scheduling recurring job...');
    await queueManager.scheduleRecurringJob({
      name: 'test-recurring',
      pattern: '*/5 * * * *', // Every 5 minutes
      action: 'test.recurring',
      priority: 3,
    });
    console.log('✓ Recurring job scheduled\n');

    // Wait a bit for jobs to process
    console.log('Waiting 3 seconds for jobs to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Final stats
    const finalStats = await queueManager.getStats();
    console.log('\n=== Final Statistics ===');
    console.log(JSON.stringify(finalStats, null, 2));

    // Cleanup
    console.log('\n=== Cleanup ===');
    await queueManager.shutdown();
    await natsClient.close();

    console.log('\n✅ All tests passed!\n');
    console.log('Phase 1 (Queue Infrastructure) is working correctly.');
    console.log('\nNext Steps:');
    console.log('  1. Start Redis: cd ../redis && docker-compose up -d');
    console.log('  2. Run this test: npm run test:queue');
    console.log('  3. Check logs for trace IDs and timing info');
    console.log('  4. Proceed to Phase 2 (Event Flow)\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testQueueInfrastructure();
