// src/app/admin/layout.tsx
import { AppLayout }                  from "@/components/layout/AppLayout";
import { AdminConfiguracionPortal }   from "./AdminConfiguracionPortal";

/**
 * Layout del área /admin.
 *
 * AdminConfiguracionPortal se monta aquí, fuera del <main>,
 * para que pueda sobreponerse a cualquier página del área admin
 * sin interferir con el contenido de las rutas hijas.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      {children}
      <AdminConfiguracionPortal />
    </AppLayout>
  );
}