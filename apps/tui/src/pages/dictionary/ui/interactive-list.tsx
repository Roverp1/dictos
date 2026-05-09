import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, type ScrollBoxProps } from "@opentui/react";
import { useState, useRef, type ReactNode } from "react";

interface InteractiveListProps<T> extends Omit<ScrollBoxProps, "children"> {
  items: T[];
  focused: boolean;

  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
  onSelect?: (item: T, index: number) => void;
  onRevert?: () => void;
}

export const InteractiveList = <T,>({
  items,
  focused,

  renderItem,
  onSelect,
  onRevert,
  ...props
}: InteractiveListProps<T>) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  useKeyboard((key) => {
    if (!focused || items.length === 0) return;

    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((prev) => {
        const next = prev + 1 >= items.length ? 0 : prev + 1;

        return next;
      });
    }

    if (key.name === "k" || key.name === "up") {
      setSelectedIndex((prev) => {
        const next = prev - 1 < 0 ? items.length - 1 : prev - 1;
        return next;
      });
    }

    if (key.name === "return" || key.name === "l" || key.name === "right") {
      onSelect?.(items[selectedIndex]!, selectedIndex);
    }

    if (key.name === "backspace" || key.name === "h" || key.name === "left") {
      onRevert?.();
      setSelectedIndex(0);
    }
  });

  return (
    <scrollbox
      ref={scrollBoxRef}
      focused
      {...props}
    >
      {items.map((item, i) => {
        const isSelected = selectedIndex === i;

        return <box key={i}>{renderItem(item, i, isSelected)}</box>;
      })}
    </scrollbox>
  );
};
