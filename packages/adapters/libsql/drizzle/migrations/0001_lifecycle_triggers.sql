-- Custom SQL migration file, put your code below! --
CREATE TRIGGER set_captures_modified_at
AFTER UPDATE ON captures
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE captures
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER set_definitions_modified_at
AFTER UPDATE ON definitions
FOR EACH ROW 
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE definitions
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER set_prompts_modified_at
AFTER UPDATE ON prompts
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE prompts
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER set_directories_modified_at
AFTER UPDATE ON directories
FOR EACH ROW
WHEN NEW.modified_at = OLD.modified_at
BEGIN
    UPDATE directories
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- cascade modified_at for directories on capture change
CREATE TRIGGER update_directory_on_capture_insert
AFTER INSERT ON captures
FOR EACH ROW
BEGIN
    UPDATE directories
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.directory_id;
END;

CREATE TRIGGER update_directory_on_capture_update
AFTER UPDATE ON captures
FOR EACH ROW
BEGIN
    UPDATE directories
    SET modified_at = strftime('%s', 'now')
    WHERE id = NEW.directory_id;

    UPDATE directories
    SET modified_at = strftime('%s', 'now')
    WHERE id = OLD.directory_id AND OLD.directory_id != NEW.directory_id;
END;

CREATE TRIGGER update_directory_on_capture_delete
AFTER DELETE ON captures
FOR EACH ROW
BEGIN
    UPDATE directories
    SET modified_at = strftime('%s', 'now')
    WHERE id = OLD.directory_id;
END;

-- update captures_added on new capture
CREATE TRIGGER increment_captures_added_on_capture_insert
AFTER INSERT ON captures
FOR EACH ROW
BEGIN
    INSERT INTO captures_added (date)
    VALUES (DATE('now'))
    ON CONFLICT (date) DO 
    UPDATE SET count = count + 1;
END;
