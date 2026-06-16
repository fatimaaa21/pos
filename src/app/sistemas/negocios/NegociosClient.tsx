"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Buscador } from "@/components/ui/Buscador";
import { StatCards } from "@/components/ui/Statscards";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalCrearNegocio } from "./ModalCrearNegocio";
import { ModalVerNegocio } from "./ModalVerNegocio";
import { ModalEditarNegocio } from "./ModalEditarNegocio";
import { toggleEstadoNegocio, eliminarNegocio } from "@/lib/actions/sistemas";
import { formatFechaHora } from "@/lib/utils/fecha";
import { ModalModulosNegocio } from "./ModalModulosNegocio";
import { LayoutGrid } from "lucide-react";
import styles from "./negocios.module.css";

export interface NegocioConAdmin {
  eCodCompany:    string;
  tNameCompany:   string;
  tSlugCompany:   string;
  imgCompany?:    string | null;
  moneda:         string;
  zona_horaria:   string;
  tipo_negocio:   "general" | "impresion";
  bStateCompany:  string;
  fhCreateCompany: string;
  admin?: {
    eCodUser:      string;
    tNameUser:     string;
    tEmailUser:    string;
    eCodeUser:     string;
    fkeCodCompany: string;
  } | null;
  totalUsuarios: number;
}

interface Props {
  negocios: NegocioConAdmin[];
}

export function NegociosClient({ negocios: inicial }: Props) {
  const [negocios, setNegocios] = useState<NegocioConAdmin[]>(inicial);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles: [],
    estados: [],
  });
  const [modalCrear, setModalCrear] = useState(false);
  const [negocioModulos, setNegocioModulos] = useState<NegocioConAdmin | null>(null);
  const [negocioVer, setNegocioVer] = useState<NegocioConAdmin | null>(null);
  const [negocioEditar, setNegocioEditar] = useState<NegocioConAdmin | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toggleando, setToggleando] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [codigoNuevo, setCodigoNuevo] = useState<{
    negocio: string;
    admin: string;
    codigo: string;
  } | null>(null);

  const filtrados = negocios.filter((n) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto ||
      n.tNameCompany.toLowerCase().includes(texto) ||
      (n.admin?.tNameUser ?? "").toLowerCase().includes(texto) ||
      (n.admin?.tEmailUser ?? "").toLowerCase().includes(texto);

    const estadoValor = n.bStateCompany === "activo" ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    return coincideTexto && coincideEstado;
  });

  function handleNegocioCreado(negocio: NegocioConAdmin, perfil: any, codigo: string) {
    const nuevo: NegocioConAdmin = {
      ...negocio,
      admin: {
        eCodUser:      perfil.eCodUser,
        tNameUser:     perfil.tNameUser,
        tEmailUser:    perfil.tEmailUser,
        eCodeUser:     codigo,
        fkeCodCompany: negocio.eCodCompany,
      },
      totalUsuarios: 1,
    };
    setNegocios((prev) => [nuevo, ...prev]);
    setModalCrear(false);
    setTimeout(() => {
      setCodigoNuevo({
        negocio: negocio.tNameCompany,
        admin:   perfil.tNameUser,
        codigo,
      });
    }, 100);
  }

  function handleEditado(actualizado: NegocioConAdmin) {
    setNegocios((prev) =>
      prev.map((n) => (n.eCodCompany === actualizado.eCodCompany ? actualizado : n))
    );
    setNegocioEditar(null);
  }

  async function handleEliminar(negocio: NegocioConAdmin) {
    if (!confirm(`¿Eliminar a ${negocio.tNameCompany}? Esta acción no se puede deshacer.`)) return;
    setEliminando(negocio.eCodCompany);
    const result = await eliminarNegocio(negocio.eCodCompany);
    if (!result?.error) {
      setNegocios((prev) => prev.filter((n) => n.eCodCompany !== negocio.eCodCompany));
    }
    setEliminando(null);
  }

  async function handleToggleEstado(negocio: NegocioConAdmin) {
    setToggleando(negocio.eCodCompany);
    const nuevoEstado = negocio.bStateCompany === "activo" ? "pausado" : "activo";
    const result = await toggleEstadoNegocio(negocio.eCodCompany, nuevoEstado);
    if (!result?.error) {
      setNegocios((prev) =>
        prev.map((n) =>
          n.eCodCompany === negocio.eCodCompany
            ? { ...n, bStateCompany: nuevoEstado }
            : n
        )
      );
    }
    setToggleando(null);
  }

  const totalActivos  = negocios.filter((n) => n.bStateCompany === "activo").length;
  const totalUsuarios = negocios.reduce((acc, n) => acc + (n.totalUsuarios ?? 0), 0);

  const columnas: ColumnaTabla<NegocioConAdmin>[] = [
    {
      key: "tNameCompany",
      label: "Negocio",
      render: (n) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.avatarNegocio}>
            {n.imgCompany ? (
              <img
                src={n.imgCompany}
                alt={n.tNameCompany}
                className={styles.avatarImg}
              />
            ) : (
              <span className={styles.avatarFallback}>
                {n.tNameCompany?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{n.tNameCompany ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "admin",
      label: "Administrador",
      render: (n) =>
        n.admin ? (
          <span>{n.admin.tNameUser}</span>
        ) : (
          <span>Sin admin</span>
        ),
    },
    {
      key: "totalUsuarios",
      label: "Usuarios",
      render: (n) => <span>{n.totalUsuarios}</span>,
    },
    {
      key: "bStateCompany",
      label: "Estado",
      render: (n) => (
        <Badge
          activo={n.bStateCompany === "activo"}
          onToggle={() => handleToggleEstado(n)}
          toggling={toggleando === n.eCodCompany}
        />
      ),
    },
    {
      key: "fhCreateCompany",
      label: "Creado",
      render: (n) => <span>{formatFechaHora(n.fhCreateCompany)}</span>,
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (n) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setNegocioVer(n)}>
            <Eye size={18} />
          </ActionBtn>
          <ActionBtn title="Editar" onClick={() => setNegocioEditar(n)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn title="Módulos" onClick={() => setNegocioModulos(n)}>
            <LayoutGrid size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(n)}
            loading={eliminando === n.eCodCompany}
            danger
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <div className="header">
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar negocio..."
        />
      </div>

      <PageHeader
        titulo="Negocios"
        descripcion="Gestiona los negocios registrados en la plataforma"
        boton={{ label: "Nuevo negocio", onClick: () => setModalCrear(true) }}
      />

      <StatCards stats={[
        { label: "Total negocios",   value: negocios.length, variante: "primary" },
        { label: "Activos",          value: totalActivos,     variante: "success" },
        { label: "Pausados",         value: negocios.length - totalActivos, variante: "accent" },
        { label: "Usuarios totales", value: totalUsuarios,    variante: "neutral" },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
        ocultarRol
      />

      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={(n) => n.eCodCompany}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay negocios registrados"
      />

      {modalCrear && (
        <ModalCrearNegocio
          onClose={() => setModalCrear(false)}
          onCreado={handleNegocioCreado}
        />
      )}
      {negocioVer && (
        <ModalVerNegocio
          negocio={negocioVer}
          onClose={() => setNegocioVer(null)}
        />
      )}
      {negocioEditar && (
        <ModalEditarNegocio
          negocio={negocioEditar}
          onClose={() => setNegocioEditar(null)}
          onEditado={handleEditado}
        />
      )}
      {negocioModulos && (
        <ModalModulosNegocio
          negocio={negocioModulos}
          onClose={() => setNegocioModulos(null)}
        />
      )}

      {codigoNuevo && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300, padding: 16, backdropFilter: "blur(4px)",
          }}
          onClick={(e) => e.target === e.currentTarget && setCodigoNuevo(null)}
        >
          <div style={{
            background: "white", borderRadius: 20,
            padding: 36, width: "100%", maxWidth: 360,
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "var(--color-success-bg)",
              border: "1px solid var(--color-success-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 22, color: "var(--color-success)",
            }}>✓</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--dark)", margin: "0 0 8px" }}>
              Negocio creado
            </h3>
            <p style={{ fontSize: 13, color: "var(--gray)", margin: "0 0 24px", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--dark)" }}>{codigoNuevo.negocio}</strong> está listo.
              Comparte este código con{" "}
              <strong style={{ color: "var(--dark)" }}>{codigoNuevo.admin}</strong>:
            </p>
            <div style={{
              fontSize: 48, fontWeight: 800, letterSpacing: 16,
              color: "var(--color-primary)", fontFamily: "monospace",
              background: "var(--background)", borderRadius: 12,
              padding: "16px 20px", marginBottom: 12,
              border: "1px solid var(--border-light)",
            }}>
              {codigoNuevo.codigo}
            </div>
            <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 24px" }}>
              Este código no se volverá a mostrar.
            </p>
            <button
              onClick={() => setCodigoNuevo(null)}
              style={{
                width: "100%", padding: 12, borderRadius: 10, border: "none",
                background: "var(--color-primary)", color: "white",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font-family)",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}