CREATE TABLE `captures_added` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captures_added_date_unique` ON `captures_added` (`date`);--> statement-breakpoint
CREATE TABLE `captures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`directory_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`directory_id`) REFERENCES `directories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captures_text_directoryId_unique` ON `captures` (`text`,`directory_id`);--> statement-breakpoint
CREATE TABLE `definitions` (
	`id` integer PRIMARY KEY NOT NULL,
	`capture_id` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`capture_id`) REFERENCES `captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `directories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`privacy` text DEFAULT 'private' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `directories`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "privacy_enum_check" CHECK("directories"."privacy" IN ('private', 'public', 'unlisted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `directories_name_parent_id_unique` ON `directories` (`name`,`parent_id`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
