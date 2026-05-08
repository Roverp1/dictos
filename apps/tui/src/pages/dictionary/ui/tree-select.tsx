import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, type ScrollBoxProps } from "@opentui/react";
import { useRef, useState } from "react";
import type { TreeItem } from "./dictionary-page";

interface TreeSelectProps extends ScrollBoxProps {
  items: TreeItem[];
  selectedIndex: number;
}

export const TreeSelect = ({
  items,
  selectedIndex,
  focused,
  ...props
}: TreeSelectProps) => {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  return (
    <scrollbox
      ref={scrollBoxRef}
      focused
      {...props}
    >
      {items.map((item, i) => (
        <text
          key={i}
          bg={selectedIndex === i ? "#78716c" : "#000"}
        >
          {item.label}
        </text>
      ))}
    </scrollbox>
  );
};
