// src/lib/utils/fecha.ts

// "28 abr 2026" — ideal para tablas
export function formatFecha(fecha?: string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

// "hace 3 días" / "hace 2 horas" — para actividad reciente
export function formatRelativo(fecha?: string | null): string {
  if (!fecha) return "—";
  const diff = Date.now() - new Date(fecha).getTime();
  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  if (dias < 7) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  return formatFecha(fecha);
}