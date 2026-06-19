"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { editarUsuario, actualizarAvatar } from "@/lib/actions/usuarios";
import type { Perfil, Sucursal } from "@/types";
import { subirAvatar } from "@/lib/supabase/storage";

interface Props {
  usuario: Perfil;
  onClose: () => void;
  onEditado: (perfil: Perfil) => void;
  sucursales: Pick<Sucursal, "eCodSucursal" | "tNombre">[];
}

export function ModalEditarUsuario({ usuario, onClose, onEditado, sucursales }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameUser: usuario.tNameUser,
    tEmailUser: usuario.tEmailUser,
    tRolUser: usuario.tRolUser,
    fkeCodSucursal: usuario.fkeCodSucursal ?? "",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodUser", usuario.eCodUser);
    formData.append("tNameUser", form.tNameUser);
    formData.append("tEmailUser", form.tEmailUser);
    formData.append("tRolUser", form.tRolUser);
    formData.append("fkeCodSucursal", form.fkeCodSucursal);

    const result = await editarUsuario(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.perfil) {
      onEditado(result.perfil);
    }
  }

  const esEmpleado = form.tRolUser === "empleado";

  const deshabilitado = !form.tNameUser.trim() || !form.tEmailUser.trim();

  return (
    <Modal
      titulo="Editar usuario"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre completo" required>
        <ModalInput
          type="text"
          value={form.tNameUser}
          onChange={(e) => setForm({ ...form, tNameUser: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Correo electrónico" required>
        <ModalInput
          type="email"
          value={form.tEmailUser}
          onChange={(e) => setForm({ ...form, tEmailUser: e.target.value })}
        />
      </ModalField>

      <ModalField label="Rol" required>
        <ModalSelect
          value={form.tRolUser}
          onChange={(e) =>
            setForm({ ...form, tRolUser: e.target.value as "admin" | "empleado" })
          }
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
    </Modal>
  );
}