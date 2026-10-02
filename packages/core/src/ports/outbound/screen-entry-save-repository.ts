import type { DbError } from "../../errors";
import type { ScreenEntrySaveInput, ScreenEntrySaveResult } from "../../models";

export interface ScreenEntrySaveRepository {
  commit(input: ScreenEntrySaveInput): Promise<ScreenEntrySaveResult | DbError>;
}
