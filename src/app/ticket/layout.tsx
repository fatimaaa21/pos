// src/app/ticket/layout.tsx
//
// Layout vacío para la ruta /ticket.
// No usa AppLayout ni Sidebar — la ventana del ticket
// es una hoja independiente que el browser puede imprimir.
export default function TicketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}