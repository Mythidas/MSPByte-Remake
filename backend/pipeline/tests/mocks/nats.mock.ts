/**
 * Mock NATS client for testing
 * Simulates the NATS pub/sub system without requiring a real NATS server
 */

import { vi } from 'vitest';

interface PublishedMessage {
  subject: string;
  data: any;
  timestamp: number;
}

interface Subscription {
  subject: string;
  handler: (data: any) => Promise<void>;
}

/**
 * Mock NATS client that captures published messages and simulates subscriptions
 */
export class MockNatsClient {
  private connected: boolean = false;
  private publishedMessages: PublishedMessage[] = [];
  private subscriptions: Map<string, Subscription[]> = new Map();

  /**
   * Simulate connecting to NATS server
   */
  async connect(): Promise<void> {
    this.connected = true;
  }

  /**
   * Capture published message for test assertions
   */
  async publish(subject: string, data: any): Promise<void> {
    if (!this.connected) {
      throw new Error('NATS not connected');
    }

    this.publishedMessages.push({
      subject,
      data,
      timestamp: Date.now(),
    });

    // Trigger any matching subscriptions
    await this.triggerSubscriptions(subject, data);
  }

  /**
   * Register a subscription handler
   */
  async subscribe(
    subject: string,
    handler: (data: any) => Promise<void>
  ): Promise<any> {
    if (!this.connected) {
      throw new Error('NATS not connected');
    }

    const subscription: Subscription = { subject, handler };

    if (!this.subscriptions.has(subject)) {
      this.subscriptions.set(subject, []);
    }

    this.subscriptions.get(subject)!.push(subscription);

    // Return mock subscription object
    return { subject, unsubscribe: vi.fn() };
  }

  /**
   * Simulate closing NATS connection
   */
  async close(): Promise<void> {
    this.connected = false;
  }

  /**
   * Trigger subscription handlers for a subject
   * Supports wildcard matching (e.g., "microsoft-365.sync.*")
   */
  private async triggerSubscriptions(subject: string, data: any): Promise<void> {
    for (const [pattern, subs] of this.subscriptions.entries()) {
      if (this.matchesPattern(subject, pattern)) {
        for (const sub of subs) {
          try {
            await sub.handler(data);
          } catch (error) {
            // Silently catch errors to mimic NATS behavior
          }
        }
      }
    }
  }

  /**
   * Check if subject matches subscription pattern
   * Supports NATS wildcard: * (matches single token), > (matches remaining path)
   */
  private matchesPattern(subject: string, pattern: string): boolean {
    // Exact match
    if (subject === pattern) return true;

    // Wildcard matching
    const subjectParts = subject.split('.');
    const patternParts = pattern.split('.');

    // Handle > (matches everything after)
    if (pattern.endsWith('>')) {
      const prefix = patternParts.slice(0, -1).join('.');
      return subject.startsWith(prefix);
    }

    // Handle * (matches single token)
    if (patternParts.length !== subjectParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== subjectParts[i]) {
        return false;
      }
    }

    return true;
  }

  // ========== Test Helper Methods ==========

  /**
   * Get all published messages (for test assertions)
   */
  getPublishedMessages(): PublishedMessage[] {
    return [...this.publishedMessages];
  }

  /**
   * Get published messages for a specific subject
   */
  getPublishedMessagesForSubject(subject: string): PublishedMessage[] {
    return this.publishedMessages.filter((msg) => msg.subject === subject);
  }

  /**
   * Get the last published message
   */
  getLastPublishedMessage(): PublishedMessage | undefined {
    return this.publishedMessages[this.publishedMessages.length - 1];
  }

  /**
   * Get the last published message for a specific subject
   */
  getLastPublishedMessageForSubject(subject: string): PublishedMessage | undefined {
    const messages = this.getPublishedMessagesForSubject(subject);
    return messages[messages.length - 1];
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get all registered subscriptions
   */
  getSubscriptions(): Map<string, Subscription[]> {
    return new Map(this.subscriptions);
  }

  /**
   * Reset mock state (clear messages and subscriptions)
   */
  reset(): void {
    this.publishedMessages = [];
    this.subscriptions.clear();
    this.connected = false;
  }

  /**
   * Manually trigger a subscription (useful for testing subscribers)
   */
  async triggerSubscription(subject: string, data: any): Promise<void> {
    await this.triggerSubscriptions(subject, data);
  }
}

/**
 * Create a new mock NATS client instance
 */
export function createMockNatsClient(): MockNatsClient {
  return new MockNatsClient();
}

/**
 * Factory for creating a mock natsClient module
 * Usage in tests: vi.mock('@workspace/pipeline/helpers/nats.js', () => ({ natsClient: createMockNatsModule() }))
 */
export function createMockNatsModule(): MockNatsClient {
  return createMockNatsClient();
}
