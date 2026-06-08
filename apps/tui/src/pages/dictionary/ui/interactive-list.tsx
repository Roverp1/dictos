import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, type ScrollBoxProps } from "@opentui/react";
import { useRef, type ReactNode, useEffect } from "react";

interface InteractiveListProps<T> extends Omit<ScrollBoxProps, "children"> {
  items: T[];
  id: string;
  selectedIndex: number;
  ListFooterComponent?: ReactNode;
  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
}

export const InteractiveList = <T,>({
  items,
  id,
  selectedIndex,
  ListFooterComponent,

  renderItem,
  ...props
}: InteractiveListProps<T>) => {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  useEffect(() => {
    if (!scrollBoxRef.current) return;

    if (ListFooterComponent) {
      scrollBoxRef.current.scrollTo(scrollBoxRef.current.scrollHeight);
    } else if (items.length > 0) {
      scrollBoxRef.current.scrollChildIntoView(`${id}-item-${selectedIndex}`);
    }
  }, [selectedIndex, ListFooterComponent, id, items.length]);

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
