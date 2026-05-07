import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, type ScrollBoxProps } from "@opentui/react";
import { useRef, useState, type ReactNode } from "react";

interface TreeSelectProps extends ScrollBoxProps {
  children: string[];
}

export const TreeSelect = ({
  children,
  focused,
  ...props
}: TreeSelectProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  useKeyboard((key) => {
    if (!focused) return;

    console.log("key.name:", key.name);
    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((prev) => {
        if (prev + 1 >= children.length) return 0;

        return prev + 1;
      });
    }
  });

  return (
    <scrollbox
      ref={scrollBoxRef}
      {...props}
    >
      {children.map((item, i) => (
        <text
          key={i}
          bg={selectedIndex === i ? "#78716c" : "#000"}
        >
          {item}
        </text>
      ))}
    </scrollbox>
  );
};
