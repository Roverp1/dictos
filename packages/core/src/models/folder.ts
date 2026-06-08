import { ValidationError } from "../errors";

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  privacy: "private" | "public" | "unlisted";
  createdAt: Date;
  modifiedAt: Date;
}

export type NewFolder = Omit<
  Folder,
  "id" | "createdAt" | "modifiedAt" | "privacy"
> &
  Partial<Pick<Folder, "privacy">>;

const VALID_PRIVACY = ["private", "public", "unlisted"] as const;

export function validateNewFolder(data: NewFolder): void | ValidationError {
  if (!data.name || data.name.trim() === "")
    return new ValidationError({ reason: "Folder name cannot be empty." });

  if (data.name.includes("/"))
    return new ValidationError({
      reason: "Folder name cannot contain slashes.",
    });

  if (data.privacy && !VALID_PRIVACY.includes(data.privacy))
    return new ValidationError({
      reason: `Invalid privacy setting. Must be one of: ${VALID_PRIVACY.join(",")}.`,
    });
}
