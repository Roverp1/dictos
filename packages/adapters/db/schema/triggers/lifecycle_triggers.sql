CREATE TRIGGER set_entries_modified_at
AFTER UPDATE ON entries
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE entries
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER set_descriptions_modified_at
AFTER UPDATE ON descriptions
FOR EACH ROW 
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE descriptions
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER set_instructions_modified_at
AFTER UPDATE ON instructions
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE instructions
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER set_folders_modified_at
AFTER UPDATE ON folders
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- cascade modified_at for folders on entry change
CREATE TRIGGER update_folder_on_entry_insert
AFTER INSERT ON entries
FOR EACH ROW
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.folder_id;
END;

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

CREATE TRIGGER update_folder_on_entry_delete
AFTER DELETE ON entries
FOR EACH ROW
BEGIN
    UPDATE folders
    SET modified_at = strftime('%s', 'now')
    WHERE id = OLD.folder_id;
END;

-- update activity on new entry
CREATE TRIGGER increment_activity_on_entry_insert
AFTER INSERT ON entries
FOR EACH ROW
BEGIN
    INSERT INTO activity (id, date)
    VALUES (uuid7_str(), DATE('now'))
    ON CONFLICT (date) DO 
    UPDATE SET count = count + 1;
END;
