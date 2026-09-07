"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalEditarMonto } from "./ModalEditarMonto";
import styles from "./facturacion.module.css";

export interface NegocioConFacturacion {
  eCodCompany:            string;
  tNameCompany:           string;
  imgCompany:             string | null;
  tipo_negocio:           "general" | "impresion" | "billar";
  bStateCompany:          string; // "activo" | "pausado"
  eMontoMensual:          number | null;
  eMontoMensualPendiente: number | null;
  tEstadoDomiciliacion:   "manual" | "domiciliado" | "pausado_por_falla" | null;
}

interface Props {
  negocios: NegocioConFacturacion[];
}

const LABEL_TIPO_NEGOCIO: Record<NegocioConFacturacion["tipo_negocio"], string> = {
  general:   "General",
  impresion: "Impresión",
  billar:    "Billar",
};

// Reutilizamos el slot opcionesCategorias del Toolbar para filtrar por tipo
// de negocio — mismo patrón que ya usa CortesAdminClient para tipo de diferencia.
const OPCIONES_TIPO_NEGOCIO = [
  { value: "general",   label: "General"   },
  { value: "impresion", label: "Impresión" },
  { value: "billar",    label: "Billar"    },
];

const fmtMoneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function FacturacionClient({ negocios: inicial }: Props) {
  const [negocios, setNegocios]           = useState<NegocioConFacturacion[]>(inicial);
  const [negocioEditar, setNegocioEditar] = useState<NegocioConFacturacion | null>(null);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda:   "",
    roles:      [],
    estados:    [],
    categorias: [],   // ← tipo de negocio, reutilizado
  });

  function handleMontoGuardado(actualizado: NegocioConFacturacion) {
    setNegocios((prev) =>
      prev.map((n) => (n.eCodCompany === actualizado.eCodCompany ? actualizado : n))
    );
    setNegocioEditar(null);
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => negocios.filter((n) => {
    const texto = filtros.busqueda.toLowerCase().trim();
    const coincideTexto =
      !texto || n.tNameCompany.toLowerCase().includes(texto);

    const tiposFiltro = filtros.categorias ?? [];
    const coincideTipo =
      tiposFiltro.length === 0 || tiposFiltro.includes(n.tipo_negocio);

    return coincideTexto && coincideTipo;
  }), [negocios, filtros]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activos  = negocios.filter((n) => n.bStateCompany === "activo").length;
  const pausados = negocios.length - activos;
  const totalMensualProyectado = negocios
    .filter((n) => n.bStateCompany === "activo")
    .reduce((acc, n) => acc + (n.eMontoMensual ?? 0), 0);

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<NegocioConFacturacion>[] = [
    {
      key: "tNameCompany",
      label: "Negocio",
      render: (n) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.avatarNegocio}>
            {n.imgCompany ? (
              <img src={n.imgCompany} alt={n.tNameCompany} className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarFallback}>
                {n.tNameCompany?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{n.tNameCompany}</span>
        </div>
      ),
    },
    {
      key: "tipo_negocio",
      label: "Tipo",
      render: (n) => <span>{LABEL_TIPO_NEGOCIO[n.tipo_negocio]}</span>,
    },
    {
      key: "bStateCompany",
      label: "Estado",
      render: (n) => <Badge activo={n.bStateCompany === "activo"} />,
    },
    {
      key: "eMontoMensual",
      label: "Pago mensual",
      render: (n) =>
        n.eMontoMensual != null ? (
          <div>
            <span style={{ fontWeight: 600 }}>{fmtMoneda(n.eMontoMensual)}</span>
            {n.eMontoMensualPendiente != null && (
              <div style={{ fontSize: 11, color: "var(--gray)" }}>
                → {fmtMoneda(n.eMontoMensualPendiente)} el próximo ciclo
              </div>
            )}
          </div>
        ) : (
          <span className={styles.sinConfigurar}>Sin configurar</span>
        ),
    },
    {
      key: "tEstadoDomiciliacion",
      label: "Domiciliación",
      render: (n) =>
        n.tEstadoDomiciliacion === "domiciliado" ? (
          <Badge variante="activo">Domiciliado</Badge>
        ) : n.tEstadoDomiciliacion === "pausado_por_falla" ? (
          <Badge variante="error">Pausado por falla</Badge>
        ) : n.tEstadoDomiciliacion === "manual" ? (
          <Badge variante="pendiente">Manual</Badge>
        ) : (
          <span className={styles.sinConfigurar}>—</span>
        ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (n) => (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            title="Fijar pago mensual"
            onClick={() => setNegocioEditar(n)}
            style={{
              width: 28, height: 28, border: "none", background: "transparent",
              borderRadius: "var(--radius-sm)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--gray)",
            }}
          >
            <Pencil size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Facturación"
        descripcion="Pago mensual y domiciliación por negocio"
      />

      <StatCards stats={[
        { label: "Total negocios",          value: negocios.length,                       variante: "primary" },
        { label: "Activos",                 value: activos,                               variante: "success" },
        { label: "Pausados",                value: pausados,                              variante: "accent"  },
        {
          label:    "Total mensual proyectado",
          value:    totalMensualProyectado.toLocaleString("es-MX", {
            style:                 "currency",
            currency:              "MXN",
            minimumFractionDigits: 0,
          }),
          variante: "neutral",
        },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
        ocultarRol
        ocultarEstado
        opcionesCategorias={OPCIONES_TIPO_NEGOCIO}
      />

      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={(n) => n.eCodCompany}
        vacio="No hay negocios registrados"
      />

      {negocioEditar && (
        <ModalEditarMonto
          negocio={negocioEditar}
          onClose={() => setNegocioEditar(null)}
          onGuardado={handleMontoGuardado}
        />
      )}
    </div>
  );
}