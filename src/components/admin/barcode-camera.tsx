"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const READER_ID = "tetsu-camera-reader";

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
];

/**
 * Escáner de código de barras con la cámara del teléfono.
 * Abre un diálogo, captura el código y lo devuelve por onDetected.
 * Requiere HTTPS (los celulares no dan cámara en HTTP).
 */
export function BarcodeScanDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const [state, setState] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onDetectedRef = useRef(onDetected);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* noop */
    }
    try {
      scanner.clear();
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      handledRef.current = false;
      setState("starting");
      setErrorMsg(null);
      const scanner = new Html5Qrcode(READER_ID, {
        verbose: false,
        formatsToSupport: BARCODE_FORMATS,
      });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 160 },
          },
          (decodedText) => {
            if (handledRef.current) return;
            handledRef.current = true;
            void (async () => {
              await stop();
              onDetectedRef.current(decodedText.trim());
              onOpenChange(false);
            })();
          },
          () => {
            /* frame sin código aún */
          }
        )
        .then(() => {
          if (!cancelled) setState("scanning");
        })
        .catch((err) => {
          if (cancelled) return;
          scannerRef.current = null;
          setState("error");
          const name = (err as { name?: string })?.name;
          if (name === "NotAllowedError") {
            setErrorMsg("Permiso de cámara denegado. Habilítalo en el navegador.");
          } else if (name === "NotFoundError") {
            setErrorMsg("No se encontró una cámara en este dispositivo.");
          } else {
            setErrorMsg("No se pudo iniciar la cámara. Verifica que entres con HTTPS.");
          }
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stop]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>

        {state === "error" ? (
          <div className="space-y-3 p-4 text-center">
            <p className="text-sm font-medium text-destructive">{errorMsg}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            {state === "starting" ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Iniciando cámara…
              </p>
            ) : null}
            <div id={READER_ID} className="w-full overflow-hidden rounded-lg border bg-black" />
            <p className="text-center text-xs text-muted-foreground">
              Apunta el código de barras al rectángulo. Se captura solo.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BarcodeCameraButton({
  label,
  onDetected,
}: {
  label?: string;
  onDetected: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Escanear con la cámara del teléfono"
      >
        <Camera className="mr-1.5 size-4" />
        {label ?? "Escanear"}
      </Button>
      <BarcodeScanDialog
        open={open}
        onOpenChange={setOpen}
        onDetected={(code) => {
          setOpen(false);
          onDetected(code);
        }}
      />
    </>
  );
}