import type { TextareaRenderable } from "@opentui/core";
import type { TextareaProps } from "@opentui/react";
import { useRef } from "react";

interface SubmitTextareaProps extends TextareaProps {
  initialValue?: string;
  onSave: (text: string) => void;
}

export const SubmitTextarea = ({
  onSave,
  initialValue = "",
  focused,
  ...props
}: SubmitTextareaProps) => {
  const textareaRef = useRef<TextareaRenderable>(null);

  return (
    <textarea
      ref={textareaRef}
      initialValue={initialValue}
      onSubmit={() => {
        if (textareaRef.current) {
          onSave(textareaRef.current.plainText);

          textareaRef.current.setText("");
        }
      }}
      keyBindings={[
        { name: "return", ctrl: true, action: "submit" },
        { name: "s", ctrl: true, action: "submit" },
      ]}
      focused={focused}
      {...props}
    />
  );
};
