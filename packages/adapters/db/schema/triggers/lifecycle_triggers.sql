-- Custom SQL migration file, put your code below! --
CREATE TRIGGER set_entries_modified_at
AFTER UPDATE ON entries
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE entries
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
--> statement-breakpoint

CREATE TRIGGER set_descriptions_modified_at
AFTER UPDATE ON descriptions
FOR EACH ROW 
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE descriptions
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
--> statement-breakpoint

CREATE TRIGGER set_instructions_modified_at
AFTER UPDATE ON instructions
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE instructions
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
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
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = OLD.folder_id;
END;
