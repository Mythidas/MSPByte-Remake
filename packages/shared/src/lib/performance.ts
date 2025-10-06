export interface PerformanceSpan {
  name: string;
  duration_ms: number;
  status: "success" | "error";
  error?: string;
}

export class PerformanceTracker {
  private startTime: number;
  private spans: PerformanceSpan[] = [];

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Track a span of work with automatic timing
   */
  async trackSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const spanStart = performance.now();

    try {
      const result = await fn();
      this.spans.push({
        name,
        duration_ms: Math.round(performance.now() - spanStart),
        status: "success",
      });
      return result;
    } catch (error) {
      this.spans.push({
        name,
        duration_ms: Math.round(performance.now() - spanStart),
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Track a synchronous span of work
   */
  trackSpanSync<T>(name: string, fn: () => T): T {
    const spanStart = performance.now();

    try {
      const result = fn();
      this.spans.push({
        name,
        duration_ms: Math.round(performance.now() - spanStart),
        status: "success",
      });
      return result;
    } catch (error) {
      this.spans.push({
        name,
        duration_ms: Math.round(performance.now() - spanStart),
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all tracked spans
   */
  getSpans(): PerformanceSpan[] {
    return this.spans;
  }

  /**
   * Get total elapsed time since tracker was created
   */
  getTotalElapsed(): number {
    return Math.round(performance.now() - this.startTime);
  }

  /**
   * Get summary of spans for debugging
   */
  getSummary(): string {
    const total = this.getTotalElapsed();
    const spanSummary = this.spans
      .map((s) => `  ${s.name}: ${s.duration_ms}ms (${s.status})`)
      .join("\n");
    return `Total: ${total}ms\nSpans:\n${spanSummary}`;
  }
}
