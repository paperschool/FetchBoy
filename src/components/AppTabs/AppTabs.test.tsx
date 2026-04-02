import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppTabs } from "./AppTabs";
import { useAppTabStore } from "@/stores/appTabStore";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock("@/components/InterceptView/InterceptView", () => ({
  InterceptView: () => (
    <div data-testid="intercept-view">Traffic Intercept Placeholder</div>
  ),
}));

describe("AppTabs", () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useAppTabStore.setState({ activeTab: "fetch" });
  });

  it('renders "Fetch" and "Intercept" tab buttons', () => {
    render(
      <AppTabs>
        <div>fetch content</div>
      </AppTabs>,
    );
    expect(screen.getByRole("tab", { name: "Fetch" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Intercept" })).toBeInTheDocument();
  });

  it("shows fetch content when Fetch tab is active", () => {
    render(
      <AppTabs>
        <div data-testid="fetch-content">fetch content</div>
      </AppTabs>,
    );
    const fetchPanel = screen.getByTestId("fetch-panel");
    expect(fetchPanel).toBeInTheDocument();
    expect(fetchPanel).not.toHaveClass("hidden");
    expect(screen.getByTestId("fetch-content")).toBeInTheDocument();
  });

  it("shows InterceptView when Intercept tab is clicked", () => {
    render(
      <AppTabs>
        <div>fetch content</div>
      </AppTabs>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Intercept" }));
    const interceptPanel = screen.getByTestId("intercept-panel");
    expect(interceptPanel).not.toHaveClass("hidden");
    expect(screen.getByTestId("intercept-view")).toBeInTheDocument();
  });

  it("hides fetch panel (not unmounts) when Intercept tab is active", () => {
    render(
      <AppTabs>
        <div data-testid="fetch-content">fetch content</div>
      </AppTabs>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Intercept" }));
    // Fetch panel is still in the DOM (visibility toggled, NOT unmounted)
    const fetchPanel = screen.getByTestId("fetch-panel");
    expect(fetchPanel).toBeInTheDocument();
    expect(fetchPanel).toHaveClass("hidden");
    // Fetch content is still in the DOM
    expect(screen.getByTestId("fetch-content")).toBeInTheDocument();
  });

  it("shows fetch content again when Fetch tab is clicked after switching to Intercept", () => {
    render(
      <AppTabs>
        <div data-testid="fetch-content">fetch content</div>
      </AppTabs>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Intercept" }));
    fireEvent.click(screen.getByRole("tab", { name: "Fetch" }));
    const fetchPanel = screen.getByTestId("fetch-panel");
    expect(fetchPanel).not.toHaveClass("hidden");
  });

  it("marks the active tab with aria-selected", () => {
    render(
      <AppTabs>
        <div>fetch content</div>
      </AppTabs>,
    );
    expect(screen.getByRole("tab", { name: "Fetch" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Intercept" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Intercept" }));
    expect(screen.getByRole("tab", { name: "Fetch" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Intercept" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
