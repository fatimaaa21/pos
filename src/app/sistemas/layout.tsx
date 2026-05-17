// Envuelve todas las rutas /admin/* con el AppLayout

import { AppLayout } from "@/components/layout/AppLayout";

export default function SistemasLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}