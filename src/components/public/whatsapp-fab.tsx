import { MessageCircle } from "lucide-react";
import { whatsappContactUrl } from "@/lib/whatsapp";

export function WhatsappFab() {
  return (
    <a
      href={whatsappContactUrl("Hola TETSU BURGER, quiero hacer un pedido.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hacer un pedido por WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
    >
      <MessageCircle aria-hidden="true" className="size-6" />
    </a>
  );
}
