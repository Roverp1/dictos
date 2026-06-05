import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface InteractiveListProps<T> {
  items: T[];
  id: string;
  selectedIndex: number;
  ListFooterComponent?: ReactNode;
  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
  flexGrow?: number;
  style?: React.CSSProperties;
}

export const InteractiveList = <T,>({
  items,
  id,
  selectedIndex,
  ListFooterComponent,
  renderItem,
  flexGrow,
  style,
}: InteractiveListProps<T>) => {
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollBoxRef.current) return;

    if (ListFooterComponent) {
      scrollBoxRef.current.scrollTop = scrollBoxRef.current.scrollHeight;
    } else if (items.length > 0) {
      const selectedElement = document.getElementById(`${id}-item-${selectedIndex}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, ListFooterComponent, id, items.length]);

  return (
    <div
      ref={scrollBoxRef}
      style={{
        flexGrow,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {items.map((item, i) => {
        const isSelected = selectedIndex === i;

        return (
          <div
            key={i}
            id={`${id}-item-${i}`}
            style={{ display: "flex", flexDirection: "column" }}
          >
            {renderItem(item, i, isSelected)}
          </div>
        );
      })}

      {ListFooterComponent && (
        <div id="ListFooterComponent" style={{ display: "flex", width: "100%" }}>
          {ListFooterComponent}
        </div>
      )}
    </div>
  );
};
