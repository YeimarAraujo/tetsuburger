import { describe, expect, it } from "vitest";
import { canTransition } from "./order-status";

describe("canTransition", () => {
  it("permite avanzar un paso del flujo", () => {
    expect(canTransition("PENDIENTE", "CONFIRMADO")).toBe(true);
    expect(canTransition("CONFIRMADO", "EN_PREPARACION")).toBe(true);
    expect(canTransition("EN_PREPARACION", "LISTO")).toBe(true);
    expect(canTransition("EN_CAMINO", "ENTREGADO", "DOMICILIO")).toBe(true);
  });

  it("solo los domicilios pasan por EN_CAMINO", () => {
    expect(canTransition("LISTO", "EN_CAMINO", "DOMICILIO")).toBe(true);
    expect(canTransition("LISTO", "ENTREGADO", "DOMICILIO")).toBe(false);
    expect(canTransition("LISTO", "ENTREGADO", "RECOGIDA")).toBe(true);
    expect(canTransition("LISTO", "EN_CAMINO", "RECOGIDA")).toBe(false);
  });

  it("no permite saltar ni retroceder pasos", () => {
    expect(canTransition("PENDIENTE", "LISTO")).toBe(false);
    expect(canTransition("LISTO", "CONFIRMADO", "DOMICILIO")).toBe(false);
  });

  it("permite cancelar desde cualquier estado activo", () => {
    expect(canTransition("PENDIENTE", "CANCELADO")).toBe(true);
    expect(canTransition("EN_PREPARACION", "CANCELADO")).toBe(true);
    expect(canTransition("EN_CAMINO", "CANCELADO", "DOMICILIO")).toBe(true);
  });

  it("ENTREGADO y CANCELADO son finales", () => {
    expect(canTransition("ENTREGADO", "PENDIENTE")).toBe(false);
    expect(canTransition("ENTREGADO", "CANCELADO")).toBe(false);
    expect(canTransition("CANCELADO", "CONFIRMADO")).toBe(false);
  });
});
