CREATE TABLE `activity` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_date_unique` ON `activity` (`date`);--> statement-breakpoint
CREATE TABLE `descriptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`entry_id` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`folder_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_text_folderId_unique` ON `entries` (`text`,`folder_id`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`privacy` text DEFAULT 'private' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "privacy_enum_check" CHECK("folders"."privacy" IN ('private', 'public', 'unlisted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_name_parent_id_unique` ON `folders` (`name`,`parent_id`);--> statement-breakpoint
CREATE TABLE `instructions` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` integer NOT NULL,
	`operation` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`bio` text,
	`avatar_url` text
);
