export function TopBar() {
  return (
    <header
      data-testid="top-bar"
      className="col-span-2 flex h-12 items-center bg-gray-900 px-4 text-white"
    >
      <span className="text-sm font-semibold tracking-wide">Dispatch</span>
    </header>
  );
}
