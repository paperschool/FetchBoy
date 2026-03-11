import { useState, useEffect } from 'react';

interface TimeoutInputProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

export function TimeoutInput({ value, onChange, disabled }: TimeoutInputProps) {
    const [inputValue, setInputValue] = useState(value.toString());

    // Sync when external value changes (e.g., tab switch)
    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Only allow digits (positive integers and zero)
        if (!/^\d*$/.test(raw)) return;
        setInputValue(raw);
    };

    const handleBlur = () => {
        const num = parseInt(inputValue, 10);
        if (isNaN(num) || num < 0) {
            setInputValue(value.toString());
            return;
        }
        onChange(num);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div className="flex items-center gap-1" title="Per-tab request timeout (0 = no timeout)">
            <input
                type="text"
                inputMode="numeric"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label="Request timeout in milliseconds"
                className="border-app-subtle bg-app-main text-app-primary h-9 w-20 rounded-md border px-2 text-sm disabled:opacity-50"
                placeholder="30000"
            />
            <span className="text-app-muted text-xs">ms</span>
        </div>
    );
}
