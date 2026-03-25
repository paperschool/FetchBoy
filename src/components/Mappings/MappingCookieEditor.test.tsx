import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MappingCookieEditor } from './MappingCookieEditor';
import type { MappingCookie } from '@/lib/db';

const validCookie: MappingCookie = {
    name: 'session', value: 'abc123', domain: '.example.com', path: '/',
    secure: true, httpOnly: true, sameSite: 'Lax', expires: '',
};

describe('MappingCookieEditor', () => {
    it('renders empty state', () => {
        render(<MappingCookieEditor cookies={[]} onChange={vi.fn()} />);
        expect(screen.getByTestId('add-cookie-btn')).toBeInTheDocument();
        expect(screen.getByText(/No cookies configured/)).toBeInTheDocument();
    });

    it('adds a new cookie row', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('add-cookie-btn'));
        expect(onChange).toHaveBeenCalledTimes(1);
        const newCookies = onChange.mock.calls[0][0];
        expect(newCookies).toHaveLength(1);
        expect(newCookies[0].name).toBe('');
        expect(newCookies[0].path).toBe('/');
    });

    it('renders existing cookie fields', () => {
        render(<MappingCookieEditor cookies={[validCookie]} onChange={vi.fn()} />);
        expect(screen.getByTestId('cookie-name-0')).toHaveValue('session');
        expect(screen.getByTestId('cookie-value-0')).toHaveValue('abc123');
        expect(screen.getByTestId('cookie-domain-0')).toHaveValue('.example.com');
        expect(screen.getByTestId('cookie-path-0')).toHaveValue('/');
    });

    it('updates cookie name', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('cookie-name-0'), { target: { value: 'token' } });
        expect(onChange.mock.calls[0][0][0].name).toBe('token');
    });

    it('updates cookie value', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('cookie-value-0'), { target: { value: 'newval' } });
        expect(onChange.mock.calls[0][0][0].value).toBe('newval');
    });

    it('toggles Secure checkbox', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('cookie-secure-0'));
        expect(onChange.mock.calls[0][0][0].secure).toBe(false);
    });

    it('toggles HttpOnly checkbox', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('cookie-httponly-0'));
        expect(onChange.mock.calls[0][0][0].httpOnly).toBe(false);
    });

    it('changes SameSite dropdown', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('cookie-samesite-0'), { target: { value: 'Strict' } });
        expect(onChange.mock.calls[0][0][0].sameSite).toBe('Strict');
    });

    it('updates expires field', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('cookie-expires-0'), { target: { value: 'Thu, 01 Jan 2026 00:00:00 GMT' } });
        expect(onChange.mock.calls[0][0][0].expires).toBe('Thu, 01 Jan 2026 00:00:00 GMT');
    });

    it('deletes a cookie row', () => {
        const onChange = vi.fn();
        render(<MappingCookieEditor cookies={[validCookie]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('cookie-delete-0'));
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it('shows validation error for empty name', () => {
        const bad: MappingCookie = { ...validCookie, name: '' };
        render(<MappingCookieEditor cookies={[bad]} onChange={vi.fn()} />);
        expect(screen.getByTestId('cookie-error-0-name')).toBeInTheDocument();
    });

    it('shows validation error for SameSite=None without Secure', () => {
        const bad: MappingCookie = { ...validCookie, sameSite: 'None', secure: false };
        render(<MappingCookieEditor cookies={[bad]} onChange={vi.fn()} />);
        expect(screen.getByTestId('cookie-error-0-secure')).toBeInTheDocument();
    });

    it('renders multiple cookies', () => {
        const two = [validCookie, { ...validCookie, name: 'token' }];
        render(<MappingCookieEditor cookies={two} onChange={vi.fn()} />);
        expect(screen.getByTestId('cookie-row-0')).toBeInTheDocument();
        expect(screen.getByTestId('cookie-row-1')).toBeInTheDocument();
    });
});
