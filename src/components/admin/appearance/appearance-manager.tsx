"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, RotateCcw, Snowflake, Sun, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  resetAppearanceImage,
  saveSiteTheme,
  uploadAppearanceImage,
} from "@/features/appearance/actions";
import {
  DEFAULT_IMAGES,
  type AppearanceSlot,
  type ImageRef,
  type SiteTheme,
  type SiteThemeSetting,
} from "@/lib/seasonal-theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const THEME_OPTIONS: {
  value: SiteThemeSetting;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: "auto",
    label: "Automático",
    description: "Navidad del 1 de diciembre al 6 de enero; el resto del año, diseño normal.",
    icon: CalendarClock,
  },
  {
    value: "normal",
    label: "Normal",
    description: "Siempre el diseño de todo el año.",
    icon: Sun,
  },
  {
    value: "navidad",
    label: "Navidad",
    description: "Siempre el diseño navideño, con decoración.",
    icon: Snowflake,
  },
];

interface GroupDef {
  title: string;
  description: string;
  dark?: boolean;
  slots: { slot: AppearanceSlot; theme: SiteTheme }[];
}

const GROUPS: GroupDef[] = [
  {
    title: "Logo",
    description:
      "Header, panel admin, login y aviso de cerrado.",
    slots: [
      { slot: "logo_normal", theme: "normal" },
      { slot: "logo_navidad", theme: "navidad" },
    ],
  },
  {
    title: "Logo para fondo oscuro",
    description: "Pie de página. Usa una versión clara del logo.",
    dark: true,
    slots: [
      { slot: "logo_blanco_normal", theme: "normal" },
      { slot: "logo_blanco_navidad", theme: "navidad" },
    ],
  },
  {
    title: "Mascota",
    description:
      "Tetsito de la portada. Recórtala sin márgenes y con fondo transparente (PNG o WebP).",
    slots: [
      { slot: "mascota_normal", theme: "normal" },
      { slot: "mascota_navidad", theme: "navidad" },
    ],
  },
];

/** Lee el ancho y alto reales de la imagen elegida. */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("invalid image"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function AppearanceManager({
  themeSetting,
  activeTheme,
  uploaded,
}: {
  themeSetting: SiteThemeSetting;
  activeTheme: SiteTheme;
  uploaded: Record<AppearanceSlot, ImageRef | null>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [theme, setTheme] = useState<SiteThemeSetting>(themeSetting);
  const [savingTheme, setSavingTheme] = useState(false);
  const [busySlot, setBusySlot] = useState<AppearanceSlot | null>(null);
  const inputs = useRef<Partial<Record<AppearanceSlot, HTMLInputElement | null>>>({});

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleTheme(next: SiteThemeSetting) {
    if (next === theme || savingTheme) return;
    const previous = theme;
    setTheme(next);
    setSavingTheme(true);
    const result = await saveSiteTheme(next);
    setSavingTheme(false);
    if (result.error) {
      setTheme(previous);
      toast.error(result.error);
      return;
    }
    toast.success("Tema guardado");
    refresh();
  }

  async function handleFile(slot: AppearanceSlot, file: File | undefined) {
    if (!file) return;
    setBusySlot(slot);
    try {
      const { width, height } = await readDimensions(file);
      const formData = new FormData();
      formData.set("slot", slot);
      formData.set("file", file);
      formData.set("width", String(width));
      formData.set("height", String(height));
      const result = await uploadAppearanceImage(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Imagen actualizada");
      refresh();
    } catch {
      toast.error("No se pudo leer la imagen");
    } finally {
      setBusySlot(null);
      const input = inputs.current[slot];
      if (input) input.value = "";
    }
  }

  async function handleReset(slot: AppearanceSlot) {
    setBusySlot(slot);
    const result = await resetAppearanceImage(slot);
    setBusySlot(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Imagen restaurada");
    refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tema del sitio</CardTitle>
          <CardDescription>
            Ahora mismo se muestra el diseño{" "}
            <strong>{activeTheme === "navidad" ? "navideño" : "normal"}</strong>.
            El cambio se guarda al elegir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Tema del sitio" className="grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={savingTheme}
                  onClick={() => handleTheme(option.value)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon className="size-4" />
                    {option.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.slots.map(({ slot, theme: slotTheme }) => {
                const custom = uploaded[slot];
                const image = custom ?? DEFAULT_IMAGES[slot];
                const busy = busySlot === slot;
                return (
                  <div key={slot} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {slotTheme === "navidad" ? "Navidad" : "Normal"}
                      </p>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {custom ? "Personalizada" : "Por defecto"}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "flex h-40 items-center justify-center rounded-md border p-3",
                        group.dark ? "bg-zinc-900" : "bg-muted/40"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.src}
                        alt=""
                        width={image.width}
                        height={image.height}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={(el) => {
                          inputs.current[slot] = el;
                        }}
                        type="file"
                        accept="image/png,image/webp,image/jpeg"
                        className="sr-only"
                        id={`file-${slot}`}
                        onChange={(e) => handleFile(slot, e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => inputs.current[slot]?.click()}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        {custom ? "Reemplazar" : "Subir imagen"}
                      </Button>
                      {custom ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleReset(slot)}
                        >
                          <RotateCcw className="size-4" />
                          Restaurar
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG, WebP o JPG · máx. 1 MB
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
