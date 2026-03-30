import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import logoUrl from "../../../src-tauri/icons/fetch-boi-logo.svg";

const NODE_COUNT = 100;
const NODE_RADIUS = 5;
const MAX_LINK_DIST = 200;
const NODE_SPEED = 0.2;
const PADDING = 30;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function createNodes(w: number, h: number): Node[] {
  return Array.from({ length: NODE_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: PADDING + Math.random() * (w - PADDING * 2),
      y: PADDING + Math.random() * (h - PADDING * 2),
      vx: Math.cos(angle) * NODE_SPEED,
      vy: Math.sin(angle) * NODE_SPEED,
    };
  });
}

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
  maxDuration?: number;
}

export function SplashScreen({
  onComplete,
  minDuration = 5000,
  maxDuration = 6000,
}: SplashScreenProps) {
  useTheme();
  const theme = useUiSettingsStore((s) => s.theme);

  const canSkipRef = useRef(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number>(0);

  // Hide the static HTML splash screen once React has mounted
  useEffect(() => {
    const el = document.getElementById("static-splash");
    if (el) el.classList.add("hidden");
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const nodes = nodesRef.current;

    ctx.clearRect(0, 0, w, h);

    // Update positions
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < PADDING || node.x > w - PADDING) node.vx *= -1;
      if (node.y < PADDING || node.y > h - PADDING) node.vy *= -1;
      node.x = Math.max(PADDING, Math.min(w - PADDING, node.x));
      node.y = Math.max(PADDING, Math.min(h - PADDING, node.y));
    }

    // Draw lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_LINK_DIST) {
          const alpha = 0.25 * (1 - dist / MAX_LINK_DIST);
          ctx.strokeStyle = `rgba(59, 100, 180, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    ctx.fillStyle = "rgba(100, 140, 210, 0.6)";
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (nodesRef.current.length === 0) {
        nodesRef.current = createNodes(canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      <div className="relative flex flex-col items-center" style={{ zIndex: 1 }}>
        <div style={{ animation: "splash-fade-in 0.5s ease-out forwards" }}>
          <img
            src={logoUrl}
            alt="FetchBoy"
            className="w-128 h-128 object-contain"
          />
        </div>
        <span
          className="absolute font-sans font-bold text-7xl tracking-wide text-gray-800 dark:text-gray-100 select-none"
          style={{
            bottom: "8%",
            animation: "splash-text-fade-in 0.6s ease-out 0.15s both",
          }}
        >
          Fetchboy
        </span>
      </div>
    </div>
  );
}
