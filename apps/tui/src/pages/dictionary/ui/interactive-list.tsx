import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, type ScrollBoxProps } from "@opentui/react";
import { useRef, type ReactNode, useEffect } from "react";

import type { FocusState } from "../model/use-dictionary";

interface InteractiveListProps<T> extends Omit<ScrollBoxProps, "children"> {
  items: T[];
  id: string;
  focused: boolean;
  focus: FocusState;

  selectedIndex: number;
  onIndexChange: React.Dispatch<React.SetStateAction<number>>;
  ListFooterComponent?: ReactNode;

  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
}

export const InteractiveList = <T,>({
  items,
  focused,
  focus,
  id,

  selectedIndex,
  onIndexChange,
  ListFooterComponent,

  renderItem,
  ...props
}: InteractiveListProps<T>) => {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  useKeyboard((key) => {
    if (
      !focused ||
      items.length === 0 ||
      focus.action === "renameInput" ||
      focus.action === "createInput"
    )
      return;

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

    if (ListFooterComponent) {
      scrollBoxRef.current.scrollTo(scrollBoxRef.current.scrollHeight);
    } else if (items.length > 0) {
      scrollBoxRef.current.scrollChildIntoView(`${id}-item-${selectedIndex}`);
    }
  }, [selectedIndex, ListFooterComponent]);

  return (
    <scrollbox
      stickyScroll={ListFooterComponent !== null}
      stickyStart="bottom"
      ref={scrollBoxRef}
      focused
      {...props}
    >
      {items.map((item, i) => {
        const isSelected = selectedIndex === i;

        return (
          <box
            key={i}
            id={`${id}-item-${i}`}
          >
            {renderItem(item, i, isSelected)}
          </box>
        );
      })}

      {ListFooterComponent && (
        <box id="ListFooterComponent">{ListFooterComponent}</box>
      )}
    </scrollbox>
  );
};
