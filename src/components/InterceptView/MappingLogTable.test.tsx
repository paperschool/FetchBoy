import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MappingLogTable } from './MappingLogTable';
import { useMappingLogStore } from '@/stores/mappingLogStore';
import type { MappingLogEntry } from '@/stores/mappingLogStore';

function makeEntry(id: string, overrides: string[] = ['headers_add']): MappingLogEntry {
    return { id, timestamp: Date.now(), method: 'GET', url: 'https://api.example.com/users', mappingId: 'm1', mappingName: 'API Mock', overridesApplied: overrides, source: 'mapping' };
}

describe('MappingLogTable', () => {
    beforeEach(() => {
        useMappingLogStore.setState({ entries: [], searchQuery: '' });
    });

    it('shows empty state when no entries', () => {
        render(<MappingLogTable />);
        expect(screen.getByText('No overrides logged yet')).toBeInTheDocument();
    });

    it('renders entries', () => {
        useMappingLogStore.setState({ entries: [makeEntry('1'), makeEntry('2')] });
        render(<MappingLogTable />);
        expect(screen.getByText('2 of 2 overrides')).toBeInTheDocument();
    });

    it('filters by search query', () => {
        useMappingLogStore.setState({
            entries: [
                makeEntry('1'),
                { ...makeEntry('2'), url: 'https://other.com', mappingName: 'Other' },
            ],
            searchQuery: 'api.example',
        });
        render(<MappingLogTable />);
        expect(screen.getByText('1 of 2 overrides')).toBeInTheDocument();
    });

    it('clears the log', () => {
        useMappingLogStore.setState({ entries: [makeEntry('1')] });
        render(<MappingLogTable />);
        fireEvent.click(screen.getByTestId('mapping-log-clear'));
        expect(useMappingLogStore.getState().entries).toHaveLength(0);
    });

    it('updates search query', () => {
        useMappingLogStore.setState({ entries: [makeEntry('1')] });
        render(<MappingLogTable />);
        fireEvent.change(screen.getByTestId('mapping-log-search'), { target: { value: 'test' } });
        expect(useMappingLogStore.getState().searchQuery).toBe('test');
    });

    it('shows override badges', () => {
        useMappingLogStore.setState({ entries: [makeEntry('1', ['headers_add', 'cookies', 'response_body'])] });
        render(<MappingLogTable />);
        expect(screen.getByTitle('Headers added')).toBeInTheDocument();
        expect(screen.getByTitle('Cookies set')).toBeInTheDocument();
        expect(screen.getByTitle('Response body overridden')).toBeInTheDocument();
    });

    it('shows source badge for mapping entries', () => {
        useMappingLogStore.setState({ entries: [makeEntry('1')] });
        render(<MappingLogTable />);
        expect(screen.getByText('MAP')).toBeInTheDocument();
    });

    it('shows source badge for breakpoint entries', () => {
        const bpEntry: MappingLogEntry = { ...makeEntry('1', ['paused']), source: 'breakpoint' };
        useMappingLogStore.setState({ entries: [bpEntry] });
        render(<MappingLogTable />);
        expect(screen.getByText('BP')).toBeInTheDocument();
    });

    it('shows remap arrows when originalUrl and remappedUrl present', () => {
        const entry: MappingLogEntry = {
            ...makeEntry('1', ['url_remap']),
            originalUrl: 'https://prod.example.com/api',
            remappedUrl: 'https://localhost:3000/api',
        };
        useMappingLogStore.setState({ entries: [entry] });
        render(<MappingLogTable />);
        expect(screen.getByText('→')).toBeInTheDocument();
    });
});
