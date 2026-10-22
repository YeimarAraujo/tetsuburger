"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

type EventData = Record<string, string | number | boolean>;

/**
 * Dispara un evento de analítica una sola vez al montar.
 * Úsalo en páginas/estados que solo se pueden observar en el cliente.
 */
export function TrackView({
  event,
  data,
}: {
  event: string;
  data?: EventData;
}) {
  const payload = data ? JSON.stringify(data) : "";

  useEffect(() => {
    track(event, payload ? JSON.parse(payload) : undefined);
  }, [event, payload]);

  return null;
}
