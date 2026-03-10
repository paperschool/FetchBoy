export function TopBar() {
  return (
    <header
      data-testid="top-bar"
      className="bg-app-topbar text-app-inverse col-span-2 flex h-12 items-center px-4"
    >
      <span className="text-sm font-semibold tracking-wide">Dispatch</span>
    </header>
  );
}
