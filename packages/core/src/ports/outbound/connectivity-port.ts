export interface ConnectivityPort {
  isOnline(): Promise<boolean>;
}
