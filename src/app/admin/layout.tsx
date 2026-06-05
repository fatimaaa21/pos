// src/app/admin/layout.tsx
import { AppLayout }                from "@/components/layout/AppLayout";
import { AdminConfiguracionPortal } from "./AdminConfiguracionPortal";
import { ToasterKivi }              from "@/components/ui/Toaster/Toaster";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      {children}
      <AdminConfiguracionPortal />
      <ToasterKivi />
    </AppLayout>
  );
}