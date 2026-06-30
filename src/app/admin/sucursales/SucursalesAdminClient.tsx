"use client";

import { useState, useTransition, useMemo }  from "react";
import toast                                  from "react-hot-toast";
import { Pencil, Trash2, Copy, Check }        from "lucide-react";
import { PageHeader }                         from "@/components/ui/PageHeader";
import { StatCards }                          from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla }       from "@/components/ui/DataTable";
import { Badge }                              from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario }  from "@/components/ui/TablaToolbar";
import { Modal, ModalField, ModalInput }      from "@/components/ui/Modal";
import { formatFechaHora }                    from "@/lib/utils/fecha";
import {
  crearSucursal,
  editarSucursal,
  toggleSucursal,
  eliminarSucursal,
}                                             from "@/lib/actions/sucursales";
import type { Sucursal }                      from "@/types";
import styles                                 from "./sucursales.module.css";

// Tipo extendido con el token (viene de la BD pero no está en el type base)
interface SucursalConToken extends Sucursal {
  tTokenCocina?: string | null;
}

interface Props {
  sucursalesIniciales: SucursalConToken[];
}

const OPCIONES_ESTADO = [
  { value: "todos",    label: "Todas"     },
  { value: "activa",   label: "Activas"   },
  { value: "inactiva", label: "Inactivas" },
];

// ── Botón copiar URL de cocina ────────────────────────────────────────────────

function BtnCopiarUrl({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/cocina/${token}`
    : `/cocina/${token}`;

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <button
      onClick={handleCopiar}
      title="Copiar URL de pantalla de cocina"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        border: copiado
          ? "1px solid var(--color-primary)"
          : "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        background: copiado ? "var(--color-primary-50)" : "var(--white)",
        color: copiado ? "var(--color-primary)" : "var(--gray)",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-family)",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {copiado ? <Check size={12} /> : <Copy size={12} />}
      {copiado ? "¡Copiada!" : "URL cocina"}
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function SucursalesAdminClient({ sucursalesIniciales }: Props) {
  const [sucursales,   setSucursales]   = useState(sucursalesIniciales);
  const [modalCrear,   setModalCrear]   = useState(false);
  const [sucursalEdit, setSucursalEdit] = useState<SucursalConToken | null>(null);
  const [form,         setForm]         = useState({ tNombre: "", tDireccion: "" });
  const [toggleando,   setToggleando]   = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();

  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda:   "",
    roles:      [],
    estados:    [],
    periodo:    "todo",
    metodo:     "todos",
    empleado:   "todos",
    categorias: [],
  });

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => sucursales.filter((s) => {
    const txt = filtros.busqueda.toLowerCase().trim();
    const coincideTexto =
      !txt ||
      s.tNombre.toLowerCase().includes(txt) ||
      (s.tDireccion ?? "").toLowerCase().includes(txt);

    const filtroEstado = filtros.estadoFiltro ?? "todos";
    const coincideEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activa"   &&  s.bStateSucursal) ||
      (filtroEstado === "inactiva" && !s.bStateSucursal);

    return coincideTexto && coincideEstado;
  }), [sucursales, filtros]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleAbrirCrear() {
    setForm({ tNombre: "", tDireccion: "" });
    setModalCrear(true);
  }

  function handleAbrirEditar(s: SucursalConToken) {
    setForm({ tNombre: s.tNombre, tDireccion: s.tDireccion ?? "" });
    setSucursalEdit(s);
  }

  function handleCrear() {
    if (!form.tNombre.trim()) { toast.error("El nombre es requerido"); return; }
    startTransition(async () => {
      const result = await crearSucursal(form.tNombre, form.tDireccion || undefined);
      if ("error" in result) { toast.error(result.error); return; }
      setSucursales((prev) => [...prev, result.sucursal as SucursalConToken]);
      setModalCrear(false);
      toast.success("Sucursal creada");
    });
  }

  function handleEditar() {
    if (!sucursalEdit || !form.tNombre.trim()) return;
    startTransition(async () => {
      const result = await editarSucursal(
        sucursalEdit.eCodSucursal,
        form.tNombre,
        form.tDireccion || undefined
      );
      if ("error" in result) { toast.error(result.error); return; }
      setSucursales((prev) =>
        prev.map((s) =>
          s.eCodSucursal === sucursalEdit.eCodSucursal
            ? { ...s, tNombre: form.tNombre, tDireccion: form.tDireccion || null }
            : s
        )
      );
      setSucursalEdit(null);
      toast.success("Sucursal actualizada");
    });
  }

  async function handleToggle(s: SucursalConToken) {
    setToggleando(s.eCodSucursal);
    const result = await toggleSucursal(s.eCodSucursal, !s.bStateSucursal);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      setSucursales((prev) =>
        prev.map((x) =>
          x.eCodSucursal === s.eCodSucursal
            ? { ...x, bStateSucursal: !s.bStateSucursal }
            : x
        )
      );
      toast.success(`Sucursal ${!s.bStateSucursal ? "activada" : "desactivada"}`);
    }
    setToggleando(null);
  }

  function handleEliminar(s: SucursalConToken) {
    toast((t) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          ¿Eliminar <strong>{s.tNombre}</strong>?
        </span>
        <span style={{ fontSize: 12, color: "var(--gray)" }}>
          Esta acción es permanente y no se puede deshacer.
        </span>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{
              padding: "4px 10px", fontSize: 12, borderRadius: 6,
              border: "1px solid var(--border-light)", background: "transparent",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              const result = await eliminarSucursal(s.eCodSucursal);
              if ("error" in result) {
                toast.error(result.error);
              } else {
                setSucursales((prev) =>
                  prev.filter((x) => x.eCodSucursal !== s.eCodSucursal)
                );
                toast.success("Sucursal eliminada");
              }
            }}
            style={{
              padding: "4px 10px", fontSize: 12, borderRadius: 6,
              border: "none", background: "var(--color-error)", color: "#fff",
              cursor: "pointer", fontWeight: 700,
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activas   = sucursales.filter((s) =>  s.bStateSucursal).length;
  const inactivas = sucursales.filter((s) => !s.bStateSucursal).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<SucursalConToken>[] = [
    {
      key: "tNombre",
      label: "Nombre",
      render: (s) => (
        <span style={{ fontWeight: 600, fontSize: 13 }}>{s.tNombre}</span>
      ),
    },
    {
      key: "tDireccion",
      label: "Dirección",
      render: (s) => (
        <span style={{ fontSize: 13, color: "var(--gray)" }}>
          {s.tDireccion ?? "—"}
        </span>
      ),
    },
    {
      key: "cocina" as any,
      label: "Pantalla cocina",
      render: (s) =>
        s.tTokenCocina ? (
          <BtnCopiarUrl token={s.tTokenCocina} />
        ) : (
          <span style={{ fontSize: 12, color: "var(--gray)" }}>—</span>
        ),
    },
    {
      key: "fhCreateSucursal",
      label: "Creada",
      render: (s) => <span>{formatFechaHora(s.fhCreateSucursal)}</span>,
    },
    {
      key: "bStateSucursal",
      label: "Estado",
      render: (s) => (
        <Badge
          activo={s.bStateSucursal}
          onToggle={() => handleToggle(s)}
          toggling={toggleando === s.eCodSucursal}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (s) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            className={styles.actionBtn}
            onClick={() => handleAbrirEditar(s)}
            disabled={isPending}
            title="Editar"
          >
            <Pencil size={18} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => handleEliminar(s)}
            disabled={isPending}
            title="Eliminar"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Sucursales"
        descripcion="Gestiona las sucursales de tu negocio"
        boton={{ label: "Nueva sucursal", onClick: handleAbrirCrear }}
      />

      <StatCards stats={[
        { label: "Total sucursales", value: sucursales.length, variante: "primary" },
        { label: "Activas",          value: activas,           variante: "success"  },
        { label: "Inactivas",        value: inactivas,         variante: "accent"   },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        ocultarEstado
        opcionesEstadoFiltro={OPCIONES_ESTADO}
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(s) => s.eCodSucursal}
        vacio="No hay sucursales registradas"
      />

      {modalCrear && (
        <Modal
          titulo="Nueva sucursal"
          onCerrar={() => setModalCrear(false)}
          onConfirmar={handleCrear}
          labelConfirmar={isPending ? "Creando..." : "Crear sucursal"}
          cargando={isPending}
          deshabilitado={!form.tNombre.trim() || isPending}
          ancho="sm"
        >
          <ModalField label="Nombre" required>
            <ModalInput
              value={form.tNombre}
              onChange={(e) => setForm({ ...form, tNombre: e.target.value })}
              placeholder="Ej. Sucursal Centro, Sucursal Norte..."
              onKeyDown={(e) => e.key === "Enter" && handleCrear()}
              autoFocus
            />
          </ModalField>
          <ModalField label="Dirección">
            <ModalInput
              value={form.tDireccion}
              onChange={(e) => setForm({ ...form, tDireccion: e.target.value })}
              placeholder="Opcional"
            />
          </ModalField>
        </Modal>
      )}

      {sucursalEdit && (
        <Modal
          titulo={`Editar — ${sucursalEdit.tNombre}`}
          onCerrar={() => setSucursalEdit(null)}
          onConfirmar={handleEditar}
          labelConfirmar={isPending ? "Guardando..." : "Guardar cambios"}
          cargando={isPending}
          deshabilitado={!form.tNombre.trim() || isPending}
          ancho="sm"
        >
          <ModalField label="Nombre" required>
            <ModalInput
              value={form.tNombre}
              onChange={(e) => setForm({ ...form, tNombre: e.target.value })}
              autoFocus
            />
          </ModalField>
          <ModalField label="Dirección">
            <ModalInput
              value={form.tDireccion}
              onChange={(e) => setForm({ ...form, tDireccion: e.target.value })}
              placeholder="Opcional"
            />
          </ModalField>
        </Modal>
      )}
    </div>
  );
}