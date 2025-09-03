export interface IProcessor {
  start(): Promise<void>;
  stop(): Promise<void>;
  connected(): Promise<boolean>;
}
