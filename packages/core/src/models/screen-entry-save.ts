import type { Description, DescriptionType } from "./description";
import type { Entry } from "./entry";
import type { Sense } from "./sense";

export type ScreenEntrySaveInput =
  | {
      kind: "entry";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
    }
  | {
      kind: "sense";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
      includeDescription: boolean;
      senseName: string;
      descriptions: { type: DescriptionType; text: string }[];
    };

export interface ScreenEntrySaveResult {
  entry: Entry;
  sense: Sense | null;
  capturedDescription: Description | null;
  descriptions: Description[];
}
