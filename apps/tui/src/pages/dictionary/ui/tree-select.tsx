import type { ScrollBoxRenderable } from "@opentui/core";
import { type ScrollBoxProps } from "@opentui/react";
import { useRef } from "react";
import type { TreeItem } from "../model/use-dictionary";

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
          key={item.id}
          bg={selectedIndex === i ? "#78716c" : "#000"}
        >
          {item.label}
        </text>
      ))}
    </scrollbox>
  );
};
