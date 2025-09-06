export default interface IConnector {
  checkHealth(): Promise<boolean>;
}
