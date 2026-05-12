import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, type ScrollBoxProps } from "@opentui/react";
import { useState, useRef, type ReactNode, useEffect } from "react";

interface InteractiveListProps<T> extends Omit<ScrollBoxProps, "children"> {
  items: T[];
  focused: boolean;

  selectedIndex: number;
  onIndexChange: React.Dispatch<React.SetStateAction<number>>;

  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
}

export const InteractiveList = <T,>({
  items,
  focused,

  selectedIndex,
  onIndexChange,

  renderItem,
  ...props
}: InteractiveListProps<T>) => {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  useKeyboard((key) => {
    if (!focused || items.length === 0) return;

    if (key.name === "j" || key.name === "down") {
      onIndexChange((prev) => {
        const next = prev + 1 >= items.length ? 0 : prev + 1;

        return next;
      });
    }

    if (key.name === "k" || key.name === "up") {
      onIndexChange((prev) => {
        const next = prev - 1 < 0 ? items.length - 1 : prev - 1;
        return next;
      });
    }
  });

  useEffect(() => {
    if (!scrollBoxRef.current) return;

    scrollBoxRef.current.scrollChildIntoView(`item-${selectedIndex}`);
  }, [selectedIndex]);

  return (
    <scrollbox
      ref={scrollBoxRef}
      focused
      {...props}
    >
      {items.map((item, i) => {
        const isSelected = selectedIndex === i;

        return (
          <box
            key={i}
            id={`item-${i}`}
          >
            {renderItem(item, i, isSelected)}
          </box>
        );
      })}
    </scrollbox>
  );
};
