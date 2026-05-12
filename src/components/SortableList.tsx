"use client";

import { ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Тонка обгортка над dnd-kit з конфігом, який працює і на сенсорних
// пристроях: довге утримання запускає перетягування, короткий тап
// та свайп для прокрутки сторінки залишаються живими.

export type SortableListProps<T extends { id: string | number }> = {
  items: T[];
  onReorder: (ids: (string | number)[]) => void;
  renderItem: (
    item: T,
    helpers: {
      dragHandleProps: React.HTMLAttributes<HTMLElement>;
      isDragging: boolean;
      setNodeRef: (el: HTMLElement | null) => void;
      style: React.CSSProperties;
    }
  ) => ReactNode;
  disabled?: boolean;
};

export function SortableList<T extends { id: string | number }>({
  items,
  onReorder,
  renderItem,
  disabled,
}: SortableListProps<T>) {
  const sensors = useSensors(
    // Десктоп: невелика дистанція щоб клік на checkbox/кнопку не починав drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Тач: довге утримання ~200ms — щоб не конфліктувало зі скролом.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((it) => it.id));
  };

  if (disabled) {
    return (
      <>
        {items.map((item) =>
          renderItem(item, {
            dragHandleProps: {},
            isDragging: false,
            setNodeRef: () => {},
            style: {},
          })
        )}
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={items.map((it) => it.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {(helpers) => renderItem(item, helpers)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  id,
  children,
}: {
  id: string | number;
  children: (helpers: {
    dragHandleProps: React.HTMLAttributes<HTMLElement>;
    isDragging: boolean;
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <>
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners,
          // touch-action: none на самій ручці — браузер не перехоплює як скрол.
          style: { touchAction: "none", cursor: "grab" },
        },
        isDragging,
        setNodeRef,
        style,
      })}
    </>
  );
}

// Уніфікована іконка ручки. Розміри підібрані під тач (≥36px target).
export function DragHandle({
  handleProps,
  label = "Перетягнути",
}: {
  handleProps: React.HTMLAttributes<HTMLElement>;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="shrink-0 inline-flex items-center justify-center w-9 h-9 -ml-1 text-fg-subtle hover:text-fg active:cursor-grabbing select-none"
      {...handleProps}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
        fill="currentColor"
      >
        <circle cx="5" cy="3" r="1.4" />
        <circle cx="5" cy="8" r="1.4" />
        <circle cx="5" cy="13" r="1.4" />
        <circle cx="11" cy="3" r="1.4" />
        <circle cx="11" cy="8" r="1.4" />
        <circle cx="11" cy="13" r="1.4" />
      </svg>
    </button>
  );
}
