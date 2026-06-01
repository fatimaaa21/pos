// src/app/admin/configuracion/page.tsx
//
// La configuración ya no vive en esta ruta.
// El modal se abre directamente desde el Sidebar usando el store de Zustand,
// sin navegación. Esta redirección evita un 404 si alguien llega por URL directa.
import { redirect } from "next/navigation";

export default function ConfiguracionPage() {
  redirect("/admin/dashboard");
}