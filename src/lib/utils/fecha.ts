// "28 abr 2026, 14:30" — cuando la hora importa
export function formatFechaHora(fecha?: string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}