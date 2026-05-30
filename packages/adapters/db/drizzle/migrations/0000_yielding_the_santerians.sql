CREATE TABLE `activities` (
	`id` text PRIMARY KEY DEFAULT (uuid_str(uuid7())) NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `descriptions` (
	`id` text PRIMARY KEY DEFAULT (uuid_str(uuid7())) NOT NULL,
	`entry_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY DEFAULT (uuid_str(uuid7())) NOT NULL,
	`text` text NOT NULL,
	`folder_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_text_folderId_unique` ON `entries` (`text`,`folder_id`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`privacy` text DEFAULT 'private' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "privacy_enum_check" CHECK("folders"."privacy" IN ('private', 'public', 'unlisted'))
);
--> statement-breakpoint
CREATE TABLE `instructions` (
	`id` text PRIMARY KEY DEFAULT (uuid_str(uuid7())) NOT NULL,
	`name` text,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY DEFAULT (uuid_str(uuid7())) NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY DEFAULT (uuid_str(uuid7())) NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`bio` text,
	`avatar_url` text
);
