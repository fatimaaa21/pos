// src/app/admin/mesas/mesas-editor-types.ts
// Tipos compartidos entre page.tsx (Server) y LayoutEditorMesas.tsx (Client).
// Separados para evitar importar desde un módulo "use client" en el servidor.

export type MesaEditorData = {
  eCodMesa:     string;
  tNombre:      string;
  e_grid_col:   number;
  e_grid_row:   number;
  e_grid_w:     number;
  e_grid_h:     number;
  t_shape:      "rect" | "circle";
  bStateMesa:   boolean;
  fkeCodConcepto?: string | null;
  ordenAbierta?: { eCodOrden: string; fhAbierta: string } | null;
};