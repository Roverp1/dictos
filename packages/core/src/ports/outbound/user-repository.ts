import type { User } from "@models/user";
import type { StorageError } from "errors";

export interface UserRepository {
  save(user: User): Promise<User | StorageError>;
  findById(id: string): Promise<User | StorageError | null>;
}
