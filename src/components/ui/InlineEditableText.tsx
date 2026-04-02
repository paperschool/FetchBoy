import type { RefObject, ChangeEvent, KeyboardEvent } from 'react';

interface InlineEditableTextProps {
  isEditing: boolean;
  editValue: string;
  displayValue: string;
  inputRef: RefObject<HTMLInputElement>;
  onEditChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEditBlur: () => void;
  onEditKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onDoubleClick: () => void;
  className?: string;
  inputClassName?: string;
  testId?: string;
}

export function InlineEditableText({
  isEditing,
  editValue,
  displayValue,
  inputRef,
  onEditChange,
  onEditBlur,
  onEditKeyDown,
  onDoubleClick,
  className = 'truncate',
  inputClassName = 'w-full min-w-0 bg-transparent text-sm outline-none',
  testId,
}: InlineEditableTextProps): React.ReactElement {
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName}
        value={editValue}
        onChange={onEditChange}
        onBlur={onEditBlur}
        onKeyDown={onEditKeyDown}
        data-testid={testId ? `${testId}-input` : undefined}
      />
    );
  }

  return (
    <span
      className={className}
      onDoubleClick={onDoubleClick}
      data-testid={testId}
    >
      {displayValue}
    </span>
  );
}
