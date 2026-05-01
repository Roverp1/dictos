CREATE TABLE `captures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`directory_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`directory_id`) REFERENCES `directories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `directories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`privacy` text DEFAULT 'private' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`modified_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `directories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "privacy_enum_check" CHECK("directories"."privacy" IN ('private', 'public', 'unlisted'))
);
