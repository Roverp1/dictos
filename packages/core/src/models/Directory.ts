import { ValidationError } from "errors";

export interface Directory {
  id: number;
  name: string;
  parentId: number | null;
  privacy: "private" | "public" | "unlisted";
  createdAt: Date;
  modifiedAt: Date;
}

export type NewDirectory = Omit<
  Directory,
  "id" | "createdAt" | "modifiedAt" | "privacy"
> &
  Partial<Pick<Directory, "privacy">>;

const VALID_PRIVACY = ["private", "public", "unlisted"] as const;

export function validateNewDirectory(
  data: NewDirectory
): void | ValidationError {
  if (!data.name || data.name.trim() === "")
    return new ValidationError({ reason: "Directory name cannot be empty." });

  if (data.name.includes("/"))
    return new ValidationError({
      reason: "Directory name cannot contain slashes.",
    });

  if (data.parentId !== null && data.parentId !== undefined) {
    if (data.parentId <= 0 || !Number.isInteger(data.parentId))
      return new ValidationError({ reason: "Invalid parent directory ID." });
  }

  if (data.privacy && !VALID_PRIVACY.includes(data.privacy))
    return new ValidationError({
      reason: `Invalid privacy setting. Must be one of: ${VALID_PRIVACY.join(",")}.`,
    });
}
