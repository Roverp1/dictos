# Keep Provider Credentials Device-Local

Provider API keys will be stored in an owner-only file in the shared Dictos data directory, behind a storage port. They will not enter the synced Dictionary database, central server, logs, or normal command output. Users must configure credentials on each device, but a Sync or Mirroring mistake cannot publish them and future clients can provide platform-native storage adapters without changing core services.
