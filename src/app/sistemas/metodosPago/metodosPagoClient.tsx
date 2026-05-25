"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import * as Icons from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Buscador } from "@/components/ui/Buscador";
import { StatCards }  from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge }      from "@/components/ui/Badge";
import {
  type MetodoPagoGlobal,
  toggleActivoMetodoPago,
  eliminarMetodoPago,
} from "@/lib/actions/metodos-pago";
import { ModalCrearMetodoPago }  from "./ModalCrearMetodoPago";
import { ModalEditarMetodoPago } from "./ModalEditarMetodoPago";
import styles from "./metodosPago.module.css";

function IconoMetodo({ nombre, size = 16 }: { nombre: string; size?: number }) {
  const Icono = (Icons as any)[nombre];
  return Icono ? <Icono size={size} /> : <Icons.CreditCard size={size} />;
}

interface Props {
  metodos: MetodoPagoGlobal[];
}

export function MetodosPagoClient({ metodos: inicial }: Props) {
  const [metodos,    setMetodos]    = useState<MetodoPagoGlobal[]>(inicial);
    const [busqueda, setBusqueda] = useState("");
  const [modalCrear, setModalCrear] = useState(false);
  const [editando,   setEditando]   = useState<MetodoPagoGlobal | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toggleando, setToggleando] = useState<string | null>(null);

  async function handleToggle(m: MetodoPagoGlobal) {
    setToggleando(m.eCodPay);
    await toggleActivoMetodoPago(m.eCodPay, !m.bStatePay);
    setMetodos((p) =>
      p.map((x) => x.eCodPay === m.eCodPay ? { ...x, bStatePay: !x.bStatePay } : x)
    );
    setToggleando(null);
  }

  async function handleEliminar(m: MetodoPagoGlobal) {
    if (!confirm(`¿Eliminar "${m.tNamePay}"? Los negocios que lo tenían activado lo perderán.`)) return;
    setEliminando(m.eCodPay);
    const result = await eliminarMetodoPago(m.eCodPay);
    if (!result?.error) {
      setMetodos((p) => p.filter((x) => x.eCodPay !== m.eCodPay));
    }
    setEliminando(null);
  }

  function handleCreado(metodo: MetodoPagoGlobal) {
    setMetodos((p) => [...p, metodo].sort((a, b) => a.orden - b.orden));
    setModalCrear(false);
  }

  function handleEditado(metodo: MetodoPagoGlobal) {
    setMetodos((p) =>
      p.map((x) => x.eCodPay === metodo.eCodPay ? metodo : x)
       .sort((a, b) => a.orden - b.orden)
    );
    setEditando(null);
  }

  const columnas: ColumnaTabla<MetodoPagoGlobal>[] = [
    {
      key: "tNamePay",
      label: "Método",
      render: (m) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={`${styles.iconoWrap} ${m.bStatePay ? styles.iconoWrapActivo : ""}`}>
            <IconoMetodo nombre={m.tIconPay} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{m.tNamePay}</p>
          </div>
        </div>
      ),
    },
    {
      key: "descripcion",
      label: "Descripción",
      render: (m) => <span>{m.descripcion ?? "—"}</span>,
    },
    {
      key: "orden",
      label: "Orden",
      render: (m) => <span>{m.orden}</span>,
    },
    {
      key: "bStatePay",
      label: "Estado",
      render: (m) => (
        <Badge
          activo={m.bStatePay}
          onToggle={() => handleToggle(m)}
          toggling={toggleando === m.eCodPay}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (m) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Editar" onClick={() => setEditando(m)}>
            <Pencil size={16} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            danger
            loading={eliminando === m.eCodPay}
            onClick={() => handleEliminar(m)}
          >
            <Trash2 size={16} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  const activos = metodos.filter((m) => m.bStatePay).length;

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
        titulo="Métodos de pago"
        descripcion="Catálogo global disponible para todos los negocios"
        boton={{ label: "Nuevo método", onClick: () => setModalCrear(true) }}
      />

      <StatCards stats={[
        { label: "Total métodos", value: metodos.length,              variante: "primary" },
        { label: "Activos",       value: activos,                     variante: "success" },
        { label: "Inactivos",     value: metodos.length - activos,    variante: "accent"  },
      ]} />

      <DataTable
        columnas={columnas}
        datos={metodos}
        keyExtractor={(m) => m.eCodPay}
        vacio="No hay métodos de pago registrados"
      />

      {modalCrear && (
        <ModalCrearMetodoPago
          onClose={() => setModalCrear(false)}
          onCreado={handleCreado}
        />
      )}

      {editando && (
        <ModalEditarMetodoPago
          metodo={editando}
          onClose={() => setEditando(null)}
          onEditado={handleEditado}
        />
      )}
    </div>
  );
}

function ActionBtn({ children, title, onClick, danger, loading }: {
  children: React.ReactNode;
  title:    string;
  onClick:  () => void;
  danger?:  boolean;
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