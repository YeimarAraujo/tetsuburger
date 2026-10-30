"use client";

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  /** Cambia este valor para reiniciar el widget tras un envío fallido. */
  resetKey?: number;
}

export function TurnstileWidget({ onToken, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const container = containerRef.current;
    if (!siteKey || !container) return;

    const key: string = siteKey;
    const target: HTMLElement = container;
    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile) return;
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(target, {
        sitekey: key,
        theme: "auto",
        callback: (token) => onTokenRef.current(token),
        "error-callback": () => onTokenRef.current(null),
        "expired-callback": () => onTokenRef.current(null),
      });
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );

    if (window.turnstile) {
      render();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [resetKey]);

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} className="min-h-[65px]" />;
}

/** Indica si el widget se mostrará (la clave pública está configurada). */
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
