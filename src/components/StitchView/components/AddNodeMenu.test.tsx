import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddNodeMenu } from './AddNodeMenu';

describe('AddNodeMenu', () => {
  const onAddNode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the add node button', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    expect(screen.getByTestId('add-node-button')).toBeInTheDocument();
    expect(screen.getByText('Add Node')).toBeInTheDocument();
  });

  it('opens menu on button click', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    fireEvent.click(screen.getByTestId('add-node-button'));
    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText('JS Snippet')).toBeInTheDocument();
    expect(screen.getByText('JSON Object')).toBeInTheDocument();
    expect(screen.getByText('Sleep')).toBeInTheDocument();
  });

  it('calls onAddNode with "request" when Request is clicked', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    fireEvent.click(screen.getByTestId('add-node-button'));
    fireEvent.click(screen.getByTestId('add-node-request'));
    expect(onAddNode).toHaveBeenCalledWith('request');
  });

  it('calls onAddNode with "js-snippet" when JS Snippet is clicked', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    fireEvent.click(screen.getByTestId('add-node-button'));
    fireEvent.click(screen.getByTestId('add-node-js-snippet'));
    expect(onAddNode).toHaveBeenCalledWith('js-snippet');
  });

  it('calls onAddNode with "json-object" when JSON Object is clicked', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    fireEvent.click(screen.getByTestId('add-node-button'));
    fireEvent.click(screen.getByTestId('add-node-json-object'));
    expect(onAddNode).toHaveBeenCalledWith('json-object');
  });

  it('calls onAddNode with "sleep" when Sleep is clicked', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    fireEvent.click(screen.getByTestId('add-node-button'));
    fireEvent.click(screen.getByTestId('add-node-sleep'));
    expect(onAddNode).toHaveBeenCalledWith('sleep');
  });

  it('closes menu after selection', () => {
    render(<AddNodeMenu onAddNode={onAddNode} />);
    fireEvent.click(screen.getByTestId('add-node-button'));
    fireEvent.click(screen.getByTestId('add-node-request'));
    expect(screen.queryByText('JS Snippet')).not.toBeInTheDocument();
  });
});
