import Joyride, { ACTIONS, EVENTS, STATUS, type CallBackProps, type Step } from 'react-joyride';
import { useTourStore } from '@/stores/tourStore';

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="collections-sidebar"]',
    content: 'Organize your API requests here',
    title: 'Collections',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="request-builder"]',
    content: 'Build your HTTP request',
    title: 'Request Builder',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="send-button"]',
    content: 'Click to send your request',
    title: 'Send Request',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '[data-tour="response-panel"]',
    content: 'View your API response here',
    title: 'Response Panel',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-tour="settings-env"]',
    content: 'Configure environments and auth',
    title: 'Settings & Environments',
    placement: 'right',
    disableBeacon: true,
  },
];

export function TourController() {
  const hasCompletedTour = useTourStore((s) => s.hasCompletedTour);
  const currentStep = useTourStore((s) => s.currentStep);
  const setCurrentStep = useTourStore((s) => s.setCurrentStep);
  const completeTour = useTourStore((s) => s.completeTour);

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
      floaterProps={{ disableAnimation: true }}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#6366f1',
          arrowColor: '#fff',
        },
        tooltip: {
          borderRadius: '0.5rem',
          fontSize: '14px',
        },
        buttonNext: {
          backgroundColor: '#6366f1',
          borderRadius: '0.375rem',
        },
        buttonBack: {
          color: '#6366f1',
        },
        buttonSkip: {
          color: '#6b7280',
        },
      }}
      callback={handleCallback}
    />
  );
}
