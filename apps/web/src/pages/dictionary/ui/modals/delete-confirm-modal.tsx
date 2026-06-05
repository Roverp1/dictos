import { useEffect } from "react";
import { useTheme } from "../../../../shared/lib/theme";

interface DeleteConfirmModalProps {
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal = ({
  itemName,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) => {
  const theme = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "y") onConfirm();
      if (e.key.toLowerCase() === "n" || e.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 3000,
      }}
    >
      <div
        style={{
          border: `2px solid ${theme.base0D}`,
          display: "flex",
          flexDirection: "column",
          width: "350px",
          backgroundColor: theme.base00,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            flexGrow: 1,
            padding: "2rem",
            textAlign: "center",
            color: theme.base05,
          }}
        >
          <div style={{ marginBottom: "1rem", fontWeight: "bold" }}>
            Delete "{itemName}"?
          </div>
          <div>Are you sure you want to delete this item?</div>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: `1px solid ${theme.base0D}`,
            height: "3rem",
          }}
        >
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              borderRight: `1px solid ${theme.base0D}`,
              color: theme.base0B,
              fontWeight: "bold",
            }}
          >
            [Y]es
          </button>

          <button
            onClick={onCancel}
            style={{
              flex: 1,
              color: theme.base08,
              fontWeight: "bold",
            }}
          >
            [N]o
          </button>
        </div>
      </div>
    </div>
  );
};
