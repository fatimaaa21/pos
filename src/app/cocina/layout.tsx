// src/app/cocina/layout.tsx
// Layout vacío — la pantalla de cocina es una vista independiente
// sin AppLayout ni Sidebar. Accesible sin autenticación mediante token.
export default function CocinaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}