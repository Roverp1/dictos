import { useEffect, useRef } from "react";
import { useDictionary } from "@dictos/react";
import { useTheme } from "../../../../shared/lib/theme";

interface CreateModalProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  focused?: boolean;
}

export const CreateModal = ({ value, onChange, onSubmit, focused }: CreateModalProps) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const { actions } = useDictionary();

  useEffect(() => {
    if (focused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        actions.general.cancelAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "20%",
        transform: "translateX(-50%)",
        width: "300px",
        padding: "1.5rem", // Increased padding
        border: `1px solid ${theme.base04}`,
        backgroundColor: theme.base01,
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        zIndex: 2000,
        boxSizing: "border-box", // Ensure padding doesn't increase width
      }}
    >
      <div style={{ color: theme.base05, marginBottom: "0.5rem", fontSize: "0.8rem" }}>
        Create:
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(value);
        }}
        style={{
          width: "100%",
          backgroundColor: theme.base00,
          color: theme.base05,
          border: `1px solid ${theme.base03}`,
          padding: "0.5rem",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
};
