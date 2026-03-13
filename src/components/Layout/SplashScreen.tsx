import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import logoUrl from "../../../src-tauri/icons/fetch-boi-logo.svg";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
  maxDuration?: number;
}

export function SplashScreen({
  onComplete,
  minDuration = 1500,
  maxDuration = 3000,
}: SplashScreenProps) {
  useTheme();
  const theme = useUiSettingsStore((s) => s.theme);

  const canSkipRef = useRef(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const complete = () => {
      if (!doneRef.current) {
        doneRef.current = true;
        onCompleteRef.current();
      }
    };

    const minTimer = setTimeout(() => {
      canSkipRef.current = true;
      complete();
    }, minDuration);

    const maxTimer = setTimeout(() => {
      complete();
    }, maxDuration);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [minDuration, maxDuration]);

  const handleClick = () => {
    if (canSkipRef.current && !doneRef.current) {
      doneRef.current = true;
      onCompleteRef.current();
    }
  };

  return (
    <div
      className={`splash-screen theme-${theme} fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer bg-white dark:bg-[#111827]`}
      onClick={handleClick}
      data-testid="splash-screen"
    >
      <div style={{ animation: "splash-fade-in 0.5s ease-out forwards" }}>
        <img
          src={logoUrl}
          alt="FetchBoy"
          className="w-128 h-128 object-contain"
        />
      </div>
    </div>
  );
}
