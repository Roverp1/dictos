import type { ScrollBoxRenderable } from "@opentui/core";
import { type ScrollBoxProps } from "@opentui/react";
import { useRef } from "react";
import type { TreeItem } from "../model/use-dictionary";

interface TreeSelectProps extends ScrollBoxProps {
  items: TreeItem[];
  selectedIndex: number;

  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (val: string) => void;
  onRenameSubmit?: (val: string) => void;
}

export const TreeSelect = ({
  items,
  selectedIndex,
  focused,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  ...props
}: TreeSelectProps) => {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  return (
    <scrollbox
      ref={scrollBoxRef}
      focused
      {...props}
    >
      {items.map((item, i) => {
        const isSelected = selectedIndex === i;
        const bgColor = selectedIndex === i ? "#78716c" : "#000";

        if (isSelected && isRenaming) {
          return (
            <box
              key={item.id}
              backgroundColor={bgColor}
              paddingX={1}
            >
              <input
                value={renameValue!}
                onChange={onRenameChange!}
                // @ts-expect-error opentui type bug
                onSubmit={onRenameSubmit}
                focused
              />
            </box>
          );
        }

        return (
          <text
            key={item.id}
            bg={bgColor}
          >
            {item.label}
          </text>
        );
      })}
    </scrollbox>
  );
};
