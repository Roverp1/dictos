import { v5 as uuidv5 } from "uuid";

export const genFolderUUIDV5 = (deterministicString: string) => {
  const FOLDER_NAMESPACE = "dedc30c7-43ae-4ca3-9779-703ab44bc508";

  return uuidv5(deterministicString, FOLDER_NAMESPACE);
};
