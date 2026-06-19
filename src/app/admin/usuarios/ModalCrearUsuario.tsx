"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { crearUsuario } from "@/lib/actions/usuarios";
import type { Perfil } from "@/types";
import { Mail } from "lucide-react";
import { obtenerSucursales } from "@/lib/actions/sucursales";
import type { Sucursal }     from "@/types";

interface Props {
  onClose: () => void;
  onCreado: (perfil: Perfil) => void;
  sucursales: Pick<Sucursal, "eCodSucursal" | "tNombre">[];
}

export function ModalCrearUsuario({ onClose, onCreado, sucursales }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameUser: "",
    tEmailUser: "",
    tRolUser: "empleado" as "admin" | "empleado",
    fkeCodSucursal: "",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("tNameUser", form.tNameUser);
    formData.append("tEmailUser", form.tEmailUser);
    formData.append("tRolUser", form.tRolUser);
    formData.append("fkeCodSucursal",  form.fkeCodSucursal);

    const result = await crearUsuario(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.perfil) {
      onCreado(result.perfil);
    }
  }

  const esEmpleado = form.tRolUser === "empleado";

  const deshabilitado =
    !form.tNameUser.trim() ||
    !form.tEmailUser.trim() ||
    !form.tRolUser ||
    (esEmpleado && !form.fkeCodSucursal);

  return (
    <Modal
      titulo="Nuevo usuario"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Crear usuario"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre completo" required>
        <ModalInput
          type="text"
          placeholder="Ej. María García"
          value={form.tNameUser}
          onChange={(e) => setForm({ ...form, tNameUser: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Correo electrónico" required>
        <ModalInput
          type="email"
          placeholder="correo@ejemplo.com"
          value={form.tEmailUser}
          onChange={(e) => setForm({ ...form, tEmailUser: e.target.value })}
        />
      </ModalField>

      <ModalField label="Rol" required>
        <ModalSelect
          value={form.tRolUser}
          style={{ cursor: "pointer" }}
          onChange={(e) => setForm({ ...form, tRolUser: e.target.value as "admin" | "empleado" })}
        >
          <option value="empleado">Empleado</option>
          <option value="admin">Administrador</option>
        </ModalSelect>
      </ModalField>

      {esEmpleado && (
        <ModalField label="Sucursal" required>
          <ModalSelect
            value={form.fkeCodSucursal}
            onChange={(e) => setForm({ ...form, fkeCodSucursal: e.target.value })}
          >
            <option value="">Seleccionar sucursal...</option>
            {sucursales.map((s) => (
              <option key={s.eCodSucursal} value={s.eCodSucursal}>
                {s.tNombre}
              </option>
            ))}
          </ModalSelect>
        </ModalField>
      )}

      <ModalInfo>
        <Mail /> Se generará un código de 4 dígitos y se enviará al correo del empleado automáticamente.
      </ModalInfo>
    </Modal>
  );
}