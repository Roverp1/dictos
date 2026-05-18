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
