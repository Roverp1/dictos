export const migrationString = `
create table \`activities\` (
	\`id\` text primary key not null,
	\`date\` text not null,
	\`count\` integer default 1 not null
);
--> statement-breakpoint
create table \`descriptions\` (
	\`id\` text primary key default (uuid_str(uuid7())) not null,
	\`entry_id\` text not null,
	\`text\` text not null,
	\`created_at\` integer default (strftime('%s', 'now')) not null,
	\`modified_at\` integer default (strftime('%s', 'now')) not null,
	foreign key (\`entry_id\`) references \`entries\`(\`id\`) on update no action on delete cascade
);
--> statement-breakpoint
create table \`entries\` (
	\`id\` text primary key not null,
	\`text\` text not null,
	\`folder_id\` text not null,
	\`created_at\` integer default (strftime('%s', 'now')) not null,
	\`modified_at\` integer default (strftime('%s', 'now')) not null,
	foreign key (\`folder_id\`) references \`folders\`(\`id\`) on update no action on delete cascade
);
--> statement-breakpoint
create table \`folders\` (
	\`id\` text primary key not null,
	\`name\` text not null,
	\`parent_id\` text,
	\`privacy\` text default 'private' not null,
	\`created_at\` integer default (strftime('%s', 'now')) not null,
	\`modified_at\` integer default (strftime('%s', 'now')) not null,
	foreign key (\`parent_id\`) references \`folders\`(\`id\`) on update no action on delete no action,
	constraint "privacy_enum_check" check("folders"."privacy" in ('private', 'public', 'unlisted'))
);
--> statement-breakpoint
create table \`instructions\` (
	\`id\` text primary key default (uuid_str(uuid7())) not null,
	\`name\` text,
	\`text\` text not null,
	\`created_at\` integer default (strftime('%s', 'now')) not null,
	\`modified_at\` integer default (strftime('%s', 'now')) not null
);
--> statement-breakpoint
create table \`outbox\` (
	\`id\` text primary key default (uuid_str(uuid7())) not null,
	\`table_name\` text not null,
	\`record_id\` text not null,
	\`operation\` text not null,
	\`created_at\` integer default (strftime('%s', 'now')) not null
);
--> statement-breakpoint
create table \`users\` (
	\`id\` text primary key default (uuid_str(uuid7())) not null,
	\`username\` text not null,
	\`email\` text not null,
	\`bio\` text,
	\`avatar_url\` text
);


-- custom sql migration file, put your code below! --
create trigger set_entries_modified_at
after update on entries
for each row
when new.modified_at = old.modified_at
begin
    update entries
    set modified_at = strftime('%s', 'now')
    where id = new.id;
end;
--> statement-breakpoint

create trigger set_descriptions_modified_at
after update on descriptions
for each row 
when new.modified_at = old.modified_at
begin
    update descriptions
    set modified_at = strftime('%s', 'now')
    where id = new.id;
end;
--> statement-breakpoint

create trigger set_instructions_modified_at
after update on instructions
for each row
when new.modified_at = old.modified_at
begin
    update instructions
    set modified_at = strftime('%s', 'now')
    where id = new.id;
end;
--> statement-breakpoint

CREATE TRIGGER set_folders_modified_at
AFTER UPDATE ON folders
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
--> statement-breakpoint

-- cascade modified_at for folders on entry change
CREATE TRIGGER update_folder_on_entry_insert
AFTER INSERT ON entries
FOR EACH ROW
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.folder_id;
END;
--> statement-breakpoint

CREATE TRIGGER update_folder_on_entry_update
AFTER UPDATE ON entries
FOR EACH ROW
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.folder_id;

    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = OLD.folder_id AND OLD.folder_id != NEW.folder_id;
END;
--> statement-breakpoint

CREATE TRIGGER update_folder_on_entry_delete
AFTER DELETE ON entries
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM folders WHERE id = OLD.folder_id)
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = OLD.folder_id;
END;
`;
