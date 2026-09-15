// Tipos de autoconsumo separados de src/lib/actions/autoconsumo.ts —
// un archivo "use server" solo puede exportar funciones async; exportar
// interfaces desde ahí rompe el build ("A 'use server' file can only export
// async functions") y en dev aparece como "unexpected response was received
// from the server" al cargar la página.

export interface AutoconsumoHistorial {
  eCodAutoconsumo:     string;
  fhCreateAutoconsumo: string;
  tNota:               string | null;
  items: {
    tNombreProductoSnapshot:     string;
    tNombrePresentacionSnapshot: string | null;
    eCantidad:                   number;
    ePrecioReferenciaSnapshot:   number;
    extras: {
      tNombreSnapshot:       string;
      eCantidadSeleccionada: number;
    }[];
  }[];
}

export interface AutoconsumoAdminRow extends AutoconsumoHistorial {
  empleado: { eCodUser: string; tNameUser: string } | null;
  insumosConsumidos: {
    tNombreInsumoSnapshot: string;
    eCantidadDescontada:   number;
    tUnidadSnapshot:       string;
  }[];
}
