import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step,
} from "react-joyride";
import { useTourStore } from "@/stores/tourStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";

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
];

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
      setCurrentStep(nextStep);
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
