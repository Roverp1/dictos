import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "../schema/schema";

export type SqliteTursoDrizzleProxy = SqliteRemoteDatabase<typeof schema>;
