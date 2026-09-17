import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableTaskItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.7 : 1,
  };

  // Extract the drag handle (the first child or a specific part)
  // But actually, we can just attach listeners to the grip icon.
  // To keep it simple, we pass the listeners down using a render prop or context, 
  // or we just wrap the whole item and let the user drag from anywhere?
  // Dragging from anywhere inside textareas is bad (it blocks typing).
  // So we only want the handle to be draggable.
  
  return (
    <div ref={setNodeRef} style={style} className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { dragHandleProps: { ...attributes, ...listeners } });
        }
        return child;
      })}
    </div>
  );
}
