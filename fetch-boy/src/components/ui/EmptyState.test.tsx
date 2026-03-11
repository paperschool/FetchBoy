import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Folder } from 'lucide-react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders icon and label', () => {
    render(<EmptyState icon={Folder} label="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders action button when action and actionLabel are provided', () => {
    const mockAction = vi.fn();
    render(<EmptyState icon={Folder} label="No items" action={mockAction} actionLabel="Add" />);
    expect(screen.getByText('Add')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add'));
    expect(mockAction).toHaveBeenCalled();
  });

  it('does not render action button when action is not provided', () => {
    render(<EmptyState icon={Folder} label="No items" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className to container', () => {
    render(<EmptyState icon={Folder} label="No items" className="custom-class" />);
    expect(screen.getByText('No items').closest('div')).toHaveClass('custom-class');
  });
});
