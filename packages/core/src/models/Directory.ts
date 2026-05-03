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
