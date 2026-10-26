export {
  resolveConfiguration,
  configurationScopes,
  describeConfiguration,
} from "./resolver";
export {
  ConfigurationError,
  globalConfigurationSchema,
  cliConfigurationSchema,
  overlayConfigurationSchema,
  configurationSchemas,
  configurationSnapshotSchema,
  valueOriginSchema,
} from "./schemas";
export type {
  GlobalConfigurationDocument,
  CliConfigurationDocument,
  OverlayConfigurationDocument,
  LogLevel,
  ConfigurationClient,
  ConfigurationScope,
  SettingId,
  ConfigurationLiteral,
  ConfigurationSettingDescription,
  ConfigurationDocument,
  ResolveConfigurationInput,
  ConfigurationIssue,
  ValueOrigin,
  ConfigurationSnapshot,
} from "./schemas";
export { validateConfigurationSnapshot } from "./snapshot";
