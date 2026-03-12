import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement window.matchMedia — provide a stub for all tests
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock localStorage for tests - zustand persist middleware uses storage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    get length() { return 0; },
    key: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);
