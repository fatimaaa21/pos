"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { editarUsuario } from "@/lib/actions/usuarios";
import type { Perfil } from "@/types";

interface Props {
  usuario: Perfil;
  onClose: () => void;
  onEditado: (perfil: Perfil) => void;
}

export function ModalEditarUsuario({ usuario, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameUser: usuario.tNameUser,
    tEmailUser: usuario.tEmailUser,
    tRolUser: usuario.tRolUser,
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodUser", usuario.eCodUser);
    formData.append("tNameUser", form.tNameUser);
    formData.append("tEmailUser", form.tEmailUser);
    formData.append("tRolUser", form.tRolUser);

    const result = await editarUsuario(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.perfil) {
      onEditado(result.perfil);
    }
  }

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

      <ModalField label="Rol">
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
    </Modal>
  );
}