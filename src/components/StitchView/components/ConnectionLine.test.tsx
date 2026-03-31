import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConnectionLine } from './ConnectionLine';

describe('ConnectionLine', () => {
  const wrap = (el: React.ReactElement): React.ReactElement => (
    <svg>{el}</svg>
  );

  it('renders an SVG path', () => {
    const { container } = render(wrap(
      <ConnectionLine fromX={0} fromY={0} toX={100} toY={100} status="active" />,
    ));
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a wider hit area when onClick is provided', () => {
    const { container } = render(wrap(
      <ConnectionLine fromX={0} fromY={0} toX={100} toY={100} status="active" onClick={() => {}} />,
    ));
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2); // hit area + visible
  });

  it('renders dashed for broken status', () => {
    const { container } = render(wrap(
      <ConnectionLine fromX={0} fromY={0} toX={100} toY={100} status="broken" />,
    ));
    const visiblePath = container.querySelectorAll('path')[0];
    expect(visiblePath.getAttribute('stroke-dasharray')).toBe('6 3');
  });
});
