"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Pencil, Trash2, Power, PowerOff }     from "lucide-react";
import toast                                             from "react-hot-toast";
import { PageHeader }                                    from "@/components/ui/PageHeader";
import { StatCards }                                     from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla }                  from "@/components/ui/DataTable";
import { Badge }                                         from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario }             from "@/components/ui/TablaToolbar";
import { Modal, ModalField, ModalInput }                 from "@/components/ui/Modal";
import {
  crearMesa,
  toggleMesa,
  editarMesa,
  eliminarMesa,
  obtenerMesasAdmin,
  abrirOrdenMesa,
  cerrarOrdenMesa,
}                                                        from "@/lib/actions/mesas";
import type { MesaConEstado }                            from "@/types";
import styles                                            from "./mesasAdmin.module.css";

interface Props {
  mesasIniciales: MesaConEstado[];
}

// ── Helper: tiempo transcurrido ───────────────────────────────────────────────

function formatElapsed(fhAbierta: string, ahora: number): string {
  const diffMs  = Math.max(0, ahora - new Date(fhAbierta).getTime());
  const seg     = Math.floor(diffMs / 1_000) % 60;
  const min     = Math.floor(diffMs / 60_000) % 60;
  const horas   = Math.floor(diffMs / 3_600_000);
  const mm      = String(min).padStart(2, "0");
  const ss      = String(seg).padStart(2, "0");
  if (horas === 0) return `${mm}:${ss}`;
  return `${horas}:${mm}:${ss}`;
}

// ── Opciones de filtro ────────────────────────────────────────────────────────

const OPCIONES_ESTADO_MESA = [
  { value: "todos",    label: "Todas"     },
  { value: "activa",   label: "Activas"   },
  { value: "inactiva", label: "Inactivas" },
];

const OPCIONES_OCUPACION = [
  { value: "libre",   label: "Libre"   },
  { value: "ocupada", label: "Ocupada" },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function MesasAdminClient({ mesasIniciales }: Props) {
  const [mesas,       setMesas]       = useState<MesaConEstado[]>(mesasIniciales);
  const [toggleando,  setToggleando]  = useState<string | null>(null);
  const [mesaEditar,  setMesaEditar]  = useState<MesaConEstado | null>(null);
  const [mesaEliminar,setMesaEliminar]= useState<MesaConEstado | null>(null);
  const [modalCrear,  setModalCrear]  = useState(false);
  const [tNombre,     setTNombre]     = useState("");
  const [isPending,   startTransition] = useTransition();

  // Reloj global para el timer de mesas ocupadas.
  // Inicia en 0 para evitar hydration mismatch; se llena en el primer efecto.
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda:   "",
    roles:      [],
    estados:    [],
    periodo:    "todo",
    metodo:     "todos",
    empleado:   "todos",
    categorias: [],
  });

  // ── Recarga desde servidor ───────────────────────────────────────────────────
  async function recargar() {
    const actualizadas = await obtenerMesasAdmin();
    setMesas(actualizadas);
  }

  // ── Toggle activo / inactivo ─────────────────────────────────────────────────
  async function handleToggle(m: MesaConEstado) {
    if (m.ordenAbierta) {
      toast.error("No puedes desactivar una mesa con una orden abierta");
      return;
    }
    setToggleando(m.eCodMesa);
    const result = await toggleMesa(m.eCodMesa, !m.bStateMesa);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      setMesas((prev) =>
        prev.map((x) =>
          x.eCodMesa === m.eCodMesa ? { ...x, bStateMesa: !m.bStateMesa } : x
        )
      );
      toast.success(`Mesa ${!m.bStateMesa ? "activada" : "desactivada"}`);
    }
    setToggleando(null);
  }

  // ── Cerrar orden de mesa (toast de confirmación) ─────────────────────────────
  function handleCerrarMesa(m: MesaConEstado) {
    if (!m.ordenAbierta) return;
    const eCodOrden = m.ordenAbierta.eCodOrden;

    toast((t) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          ¿Cerrar <strong>{m.tNombre}</strong>?
        </span>
        <span style={{ fontSize: 12, color: "var(--gray)" }}>
          La orden se cancelará sin generar cobro.
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
              const result = await cerrarOrdenMesa(eCodOrden);
              if ("error" in result) {
                toast.error(result.error);
              } else {
                toast.success(`${m.tNombre} cerrada`);
                await recargar();
              }
            }}
            style={{
              padding: "4px 10px", fontSize: 12, borderRadius: 6,
              border: "none", background: "var(--color-error)", color: "#fff",
              cursor: "pointer", fontWeight: 700,
            }}
          >
            Cerrar mesa
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  }

  // ── Abrir orden en mesa ──────────────────────────────────────────────────────
  async function handleAbrirMesa(m: MesaConEstado) {
    setToggleando(m.eCodMesa); // reutilizamos el loading state por mesa
    const result = await abrirOrdenMesa(m.eCodMesa);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Orden abierta en ${m.tNombre}`);
      await recargar();
    }
    setToggleando(null);
  }

  // ── Crear mesa ───────────────────────────────────────────────────────────────
  function handleAbrirCrear() { setTNombre(""); setModalCrear(true); }

  function handleCrear() {
    const nombre = tNombre.trim();
    if (!nombre) { toast.error("El nombre es requerido"); return; }

    startTransition(async () => {
      const result = await crearMesa(nombre);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Mesa creada");
      setModalCrear(false);
      setTNombre("");
      await recargar();
    });
  }

  // ── Editar mesa ──────────────────────────────────────────────────────────────
  function handleAbrirEditar(m: MesaConEstado) {
    setTNombre(m.tNombre);
    setMesaEditar(m);
  }

  function handleEditar() {
    if (!mesaEditar) return;
    const nombre = tNombre.trim();
    if (!nombre) { toast.error("El nombre es requerido"); return; }

    startTransition(async () => {
      const result = await editarMesa(mesaEditar.eCodMesa, nombre);
      if ("error" in result) { toast.error(result.error); return; }
      setMesas((prev) =>
        prev.map((x) =>
          x.eCodMesa === mesaEditar.eCodMesa ? { ...x, tNombre: nombre } : x
        )
      );
      toast.success("Mesa actualizada");
      setMesaEditar(null);
    });
  }

  // ── Eliminar mesa ────────────────────────────────────────────────────────────
  function handleConfirmarEliminar() {
    if (!mesaEliminar) return;

    startTransition(async () => {
      const result = await eliminarMesa(mesaEliminar.eCodMesa);
      if ("error" in result) { toast.error(result.error); return; }
      setMesas((prev) => prev.filter((x) => x.eCodMesa !== mesaEliminar.eCodMesa));
      toast.success("Mesa eliminada");
      setMesaEliminar(null);
    });
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const total    = mesas.length;
  const activas  = mesas.filter((m) =>  m.bStateMesa).length;
  const ocupadas = mesas.filter((m) => !!m.ordenAbierta).length;
  const libres   = activas - ocupadas;

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => mesas.filter((m) => {
    const txt = filtros.busqueda.toLowerCase().trim();
    const coincideTexto = !txt || m.tNombre.toLowerCase().includes(txt);

    const filtroEstado = filtros.estadoFiltro ?? "todos";
    const coincideEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activa"   &&  m.bStateMesa) ||
      (filtroEstado === "inactiva" && !m.bStateMesa);

    const filtrosOcup = filtros.categorias ?? [];
    const ocupada     = !!m.ordenAbierta;
    const coincideOcup =
      filtrosOcup.length === 0 ||
      (filtrosOcup.includes("ocupada") &&  ocupada) ||
      (filtrosOcup.includes("libre")   && !ocupada);

    return coincideTexto && coincideEstado && coincideOcup;
  }), [mesas, filtros]);

  // ── Columnas ─────────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<MesaConEstado>[] = [
    {
      key:   "tNombre",
      label: "Mesa",
      render: (m) => (
          <span>{m.tNombre}</span>
      ),
    },
    {
      key:   "bStateMesa",
      label: "Estado",
      render: (m) => (
        <Badge
          activo={m.bStateMesa}
          onToggle={() => handleToggle(m)}
          toggling={toggleando === m.eCodMesa}
        />
      ),
    },
    {
      key:   "ocupacion",
      label: "Ocupación",
      render: (m) => {
        if (!m.bStateMesa) {
          return <span style={{ color: "var(--gray-light)", fontSize: 13 }}>—</span>;
        }
        return m.ordenAbierta
          ? <Badge variante="pendiente">Ocupada</Badge>
          : <Badge variante="disponible">Libre</Badge>;
      },
    },
    {
      key:   "tiempoAbierta",
      label: "Tiempo en mesa",
      render: (m) => {
        if (!m.ordenAbierta?.fhAbierta || ahora === 0) {
          return <span style={{ color: "var(--gray-light)", fontSize: 13 }}>—</span>;
        }
        return (
          <span className={styles.tiempoCell}>
            {formatElapsed(m.ordenAbierta.fhAbierta, ahora)}
          </span>
        );
      },
    },
    {
      key:   "acciones",
      label: "Acciones",
      render: (m) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            className={styles.actionBtn}
            title="Abrir mesa"
            onClick={() => handleAbrirMesa(m)}
            disabled={!m.bStateMesa || !!m.ordenAbierta || toggleando === m.eCodMesa || isPending}
          >
            <Power size={18} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnWarning}`}
            title="Cerrar mesa"
            onClick={() => handleCerrarMesa(m)}
            disabled={!m.ordenAbierta || isPending}
          >
            <PowerOff size={18} />
          </button>
          <button
            className={styles.actionBtn}
            title="Editar nombre"
            onClick={() => handleAbrirEditar(m)}
            disabled={isPending}
          >
            <Pencil size={18} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="Eliminar mesa"
            onClick={() => setMesaEliminar(m)}
            disabled={isPending || !!m.ordenAbierta}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="container">
        <PageHeader
          titulo="Mesas"
          descripcion="Gestión y estado de mesas del negocio"
          boton={{ label: "Nueva mesa", onClick: handleAbrirCrear }}
        />

        <StatCards stats={[
          { label: "Total de mesas", value: total,    variante: "primary" },
          { label: "Activas",        value: activas,  variante: "success" },
          { label: "Ocupadas",       value: ocupadas, variante: "warning" },
          { label: "Libres",         value: libres,   variante: "neutral" },
        ]} />

        <TablaToolbar
          filtros={filtros}
          onChange={setFiltros}
          total={filtradas.length}
          ocultarRol
          ocultarEstado
          opcionesEstadoFiltro={OPCIONES_ESTADO_MESA}
          opcionesCategorias={OPCIONES_OCUPACION}
        />

        <DataTable
          columnas={columnas}
          datos={filtradas}
          keyExtractor={(m) => m.eCodMesa}
          vacio="No hay mesas configuradas"
        />
      </div>

      {/* ── Modal crear ── */}
      {modalCrear && (
        <Modal
          titulo="Nueva mesa"
          onCerrar={() => setModalCrear(false)}
          onConfirmar={handleCrear}
          labelConfirmar={isPending ? "Creando..." : "Crear mesa"}
          labelCancelar="Cancelar"
          deshabilitado={isPending || !tNombre.trim()}
          cargando={isPending}
          ancho="sm"
        >
          <ModalField label="Nombre de la mesa" required>
            <ModalInput
              value={tNombre}
              onChange={(e) => setTNombre(e.target.value)}
              placeholder="Ej. Mesa 1, Terraza A, Barra..."
              onKeyDown={(e) => e.key === "Enter" && handleCrear()}
              autoFocus
            />
          </ModalField>
        </Modal>
      )}

      {/* ── Modal editar ── */}
      {mesaEditar && (
        <Modal
          titulo={`Editar — ${mesaEditar.tNombre}`}
          onCerrar={() => setMesaEditar(null)}
          onConfirmar={handleEditar}
          labelConfirmar={isPending ? "Guardando..." : "Guardar cambios"}
          labelCancelar="Cancelar"
          deshabilitado={isPending || !tNombre.trim()}
          cargando={isPending}
          ancho="sm"
        >
          <ModalField label="Nombre de la mesa" required>
            <ModalInput
              value={tNombre}
              onChange={(e) => setTNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEditar()}
              autoFocus
            />
          </ModalField>
        </Modal>
      )}

      {/* ── Modal confirmar eliminación ── */}
      {mesaEliminar && (
        <Modal
          titulo="Eliminar mesa"
          onCerrar={() => setMesaEliminar(null)}
          onConfirmar={handleConfirmarEliminar}
          labelConfirmar={isPending ? "Eliminando..." : "Eliminar mesa"}
          labelCancelar="Cancelar"
          deshabilitado={isPending}
          cargando={isPending}
          ancho="sm"
        >
          <p style={{ fontSize: 14, color: "var(--dark)", margin: 0 }}>
            ¿Estás seguro de eliminar{" "}
            <strong>{mesaEliminar.tNombre}</strong>?
          </p>
          <p style={{ fontSize: 13, color: "var(--gray)", marginTop: 8 }}>
            Esta acción es permanente y no se puede deshacer. Si la mesa tiene
            historial de pedidos, se perderá la referencia.
          </p>
        </Modal>
      )}

    </>
  );
}