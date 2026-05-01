PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_captures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`directory_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_captures`("id", "text", "directory_id", "created_at", "modified_at") SELECT "id", "text", "directory_id", "created_at", "modified_at" FROM `captures`;--> statement-breakpoint
DROP TABLE `captures`;--> statement-breakpoint
ALTER TABLE `__new_captures` RENAME TO `captures`;--> statement-breakpoint
PRAGMA foreign_keys=ON;