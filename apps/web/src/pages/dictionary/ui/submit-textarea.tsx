import { useEffect, useRef } from "react";
import { useDictionary } from "@dictos/react";
import { useTheme } from "../../../shared/lib/theme";

interface SubmitTextareaProps {
  initialValue?: string;
  onSave: (text: string) => void;
  focused?: boolean;
}

export const SubmitTextarea = ({
  onSave,
  initialValue = "",
  focused,
}: SubmitTextareaProps) => {
  const theme = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { actions } = useDictionary();

  useEffect(() => {
    if (focused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [focused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === "Enter" || e.key === "s") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave(textareaRef.current?.value || "");
      if (textareaRef.current) textareaRef.current.value = "";
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      actions.general.cancelAction();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={initialValue}
      onKeyDown={handleKeyDown}
      style={{
        width: "100%",
        backgroundColor: theme.base00,
        color: theme.base05,
        border: "none",
        outline: "none",
        fontFamily: "inherit",
        fontSize: "inherit",
        resize: "none",
        padding: "0.5rem",
        boxSizing: "border-box", // Fix width overflow
      }}
    />
  );
};
