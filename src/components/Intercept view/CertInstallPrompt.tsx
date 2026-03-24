import Joyride, { EVENTS, STATUS, type CallBackProps, type Step } from "react-joyride";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";

const CERT_PROMPT_STEP: Step[] = [
  {
    target: '[data-tour="install-cert"]',
    content:
      "You need to install the CA certificate before starting the proxy. This lets FetchBoy decrypt and inspect HTTPS traffic. Click Install Certificate to get started.",
    title: "Certificate Required",
    placement: "top",
    disableBeacon: true,
  },
];

export function CertInstallPrompt() {
  const showPrompt = useUiSettingsStore((s) => s.flashInstallCert);
  const setShowPrompt = useUiSettingsStore((s) => s.setFlashInstallCert);

  // Subscribe to theme to force re-render on theme change
  useUiSettingsStore((s) => s.theme);

  if (!showPrompt) return null;

  const css = getComputedStyle(document.documentElement);
  const bgColor = css.getPropertyValue("--app-surface-main").trim();
  const textColor = css.getPropertyValue("--app-text-primary").trim();
  const borderColor = css.getPropertyValue("--app-border-subtle").trim();

  function handleCallback(data: CallBackProps) {
    const { status, type } = data;
    if (
      type === EVENTS.STEP_AFTER ||
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED
    ) {
      setShowPrompt(false);
    }
  }

  return (
    <Joyride
      steps={CERT_PROMPT_STEP}
      run={true}
      continuous={false}
      showSkipButton={false}
      showProgress={false}
      disableCloseOnEsc={false}
      disableOverlayClose={true}
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
      }}
      locale={{ last: "Got it" }}
      callback={handleCallback}
    />
  );
}
