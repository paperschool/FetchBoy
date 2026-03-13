import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step,
} from "react-joyride";
import { useTourStore } from "@/stores/tourStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useAppTabStore } from "@/stores/appTabStore";

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="collections-sidebar"]',
    content:
      "Organize your API requests here, storing them in named folders for easy access. The history tab keeps track of all your past requests, allowing you to quickly revisit and resend them whenever needed.",
    title: "Collections",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="request-builder"]',
    content: "Build your HTTP request here by specifying the method, URL",
    title: "Request Builder",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="request-details"]',
    content:
      "The details section allows you to configure advanced options like query parameters, authentication, and more.",
    title: "Request Details",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="request-controls"]',
    content:
      "Click to send your request, save the current request configuration to the collections tab or even copy a request for usage outside of the application",
    title: "Request Controls",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="response-panel"]',
    content:
      "View your API response here complete with status code, headers, and body and logging of internals",
    title: "Response Panel",
    placement: "left",
    disableBeacon: true,
  },
  {
    target: '[data-tour="configure-environments"]',
    content:
      "Configure environments to easily switch between different setups like development, staging, and production. Allows for injecting of dynamic variables into your requests using the {{variableName}} syntax.",
    title: "Environments",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="settings-env"]',
    content:
      "Configure application settings such as theme, request timeouts, and more to tailor the app to your preferences and needs.",
    title: "Settings",
    placement: "top",
    disableBeacon: true,
  },
  // ── Intercept tab steps ────────────────────────────────────────────────────
  {
    target: '[data-tour="intercept-tab"]',
    content:
      "The Intercept tab lets you monitor all HTTP and HTTPS traffic flowing through the app's built-in MITM proxy. You can inspect request and response details in real time, filter by method or status, and load any captured request directly into the Fetch builder.",
    title: "Intercept",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="intercept-settings"]',
    content:
      "Before you can capture HTTPS traffic, install the CA certificate into your system trust store — this is what lets the proxy decrypt and inspect TLS connections. You can also adjust the proxy port here if the default 8080 conflicts with another service.",
    title: "Certificate & Proxy Setup",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="intercept-search"]',
    content:
      "Filter captured traffic by keyword or regular expression, and narrow down results by HTTP method or status code range. The request count updates live to reflect the current filter.",
    title: "Search & Filter",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="intercept-request-table"]',
    content:
      "Every request that flows through the proxy appears here in real time. Click any row to load its full details in the panel below, or hover a row to reveal the Fetch button which opens that request in the Fetch tab ready to replay or modify.",
    title: "Request Table",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-testid="intercept-detail-viewer"]',
    content:
      "The detail panel shows the full response body with syntax highlighting, request and response headers, and parsed query parameters. Use the Open in Fetch button at the top to send the captured request to the Fetch tab with all its method, URL, params and headers pre-filled.",
    title: "Request Detail",
    placement: "left",
    disableBeacon: true,
  },
];

/** Index of the first intercept-specific tour step. */
const INTERCEPT_STEPS_START = 7;

export function TourController() {
  const hasCompletedTour = useTourStore((s) => s.hasCompletedTour);
  const currentStep = useTourStore((s) => s.currentStep);
  const setCurrentStep = useTourStore((s) => s.setCurrentStep);
  const completeTour = useTourStore((s) => s.completeTour);

  // Subscribe to theme to force re-render on theme change
  useUiSettingsStore((s) => s.theme);

  const css = getComputedStyle(document.documentElement);
  const bgColor = css.getPropertyValue("--app-surface-main").trim();
  const textColor = css.getPropertyValue("--app-text-primary").trim();
  const mutedColor = css.getPropertyValue("--app-text-muted").trim();
  const borderColor = css.getPropertyValue("--app-border-subtle").trim();

  function handleCallback(data: CallBackProps) {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStep = index + (action === ACTIONS.PREV ? -1 : 1);

      if (nextStep >= INTERCEPT_STEPS_START) {
        // Switch to intercept tab and ensure sidebar is expanded so all targets are visible.
        useAppTabStore.getState().setActiveTab("intercept");
        useUiSettingsStore.getState().setSidebarCollapsed(false);
        useUiSettingsStore.getState().setSidebarSettingsExpanded(true);
      } else {
        useAppTabStore.getState().setActiveTab("fetch");
      }

      // Small delay so the DOM updates from the tab switch propagate before
      // Joyride looks for the next step's target element.
      setTimeout(() => setCurrentStep(nextStep), 50);
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      completeTour();
    }
  }

  if (hasCompletedTour) {
    return null;
  }

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={true}
      stepIndex={currentStep}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      disableCloseOnEsc={false}
      disableOverlayClose={false}
      disableScrolling={true}
      floaterProps={{ disableAnimation: true }}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: "#6366f1",
          backgroundColor: bgColor,
          textColor: textColor,
          arrowColor: bgColor,
        },
        tooltip: {
          borderRadius: "0.5rem",
          fontSize: "14px",
          padding: "12px 16px",
          border: `1px solid ${borderColor}`,
        },
        tooltipTitle: {
          fontSize: "14px",
          fontWeight: "600",
          textAlign: "left",
          padding: "0 0 6px 0",
          marginBottom: 0,
        },
        tooltipContent: {
          textAlign: "left",
          padding: "0",
          fontSize: "13px",
          color: textColor,
        },
        tooltipFooter: {
          padding: "8px 0 0 0",
          marginTop: 0,
          justifyContent: "flex-start",
          gap: "8px",
        },
        buttonNext: {
          backgroundColor: "#6366f1",
          borderRadius: "0.375rem",
          padding: "6px 12px",
          fontSize: "13px",
        },
        buttonBack: {
          color: "#6366f1",
          fontSize: "13px",
          marginRight: 0,
        },
        buttonSkip: {
          color: mutedColor,
          fontSize: "13px",
        },
      }}
      callback={handleCallback}
    />
  );
}
