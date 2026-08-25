/** Beep de nuevo pedido sin archivos externos (Web Audio API) */
let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new window.AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function playNewOrderSound() {
  const audio = ensureCtx();
  if (!audio) return;

  const beep = (startAt: number, freq: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.type = "sine";
    osc.frequency.value = freq;

    const t = audio.currentTime + startAt;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    osc.start(t);
    osc.stop(t + 0.45);
  };

  // Doble pitido característico de comanda nueva
  beep(0, 880);
  beep(0.28, 1175);
}
