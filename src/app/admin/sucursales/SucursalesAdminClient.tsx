"use client";

import { useState, useTransition }          from "react";
import toast                                  from "react-hot-toast";
import { Pencil }                             from "lucide-react";
import { PageHeader }                         from "@/components/ui/PageHeader";
import { StatCards }                          from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla }       from "@/components/ui/DataTable";
import { Badge }                              from "@/components/ui/Badge";
import { Modal, ModalField, ModalInput }      from "@/components/ui/Modal";
import { formatFechaHora }                    from "@/lib/utils/fecha";
import { crearSucursal, editarSucursal, toggleSucursal } from "@/lib/actions/sucursales";
import type { Sucursal } from "@/types";
import styles from "./sucursales.module.css";

interface Props {
  sucursalesIniciales: Sucursal[];
}

export function SucursalesAdminClient({ sucursalesIniciales }: Props) {
  const [sucursales,   setSucursales]   = useState(sucursalesIniciales);
  const [modalCrear,   setModalCrear]   = useState(false);
  const [sucursalEdit, setSucursalEdit] = useState<Sucursal | null>(null);
  const [form,         setForm]         = useState({ tNombre: "", tDireccion: "" });
  const [toggleando,   setToggleando]   = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();

  function handleAbrirCrear() {
    setForm({ tNombre: "", tDireccion: "" });
    setModalCrear(true);
  }

  function handleAbrirEditar(s: Sucursal) {
    setForm({ tNombre: s.tNombre, tDireccion: s.tDireccion ?? "" });
    setSucursalEdit(s);
  }

  function handleCrear() {
    if (!form.tNombre.trim()) { toast.error("El nombre es requerido"); return; }
    startTransition(async () => {
      const result = await crearSucursal(form.tNombre, form.tDireccion || undefined);
      if ("error" in result) { toast.error(result.error); return; }
      setSucursales((prev) => [...prev, result.sucursal]);
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

  async function handleToggle(s: Sucursal) {
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

  const activas   = sucursales.filter((s) =>  s.bStateSucursal).length;
  const inactivas = sucursales.filter((s) => !s.bStateSucursal).length;

  const columnas: ColumnaTabla<Sucursal>[] = [
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
        <button
          className={styles.btnEditar}
          onClick={() => handleAbrirEditar(s)}
          disabled={isPending}
          title="Editar"
        >
          <Pencil size={18} />
        </button>
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
        { label: "Activas",          value: activas,           variante: "success" },
        { label: "Inactivas",        value: inactivas,         variante: "accent"  },
      ]} />

      <DataTable
        columnas={columnas}
        datos={sucursales}
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