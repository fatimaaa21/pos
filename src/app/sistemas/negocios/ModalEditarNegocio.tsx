"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { editarNegocio } from "@/lib/actions/sistemas";
import type { NegocioConAdmin } from "./NegociosClient";

interface Props {
  negocio: NegocioConAdmin;
  onClose: () => void;
  onEditado: (negocio: NegocioConAdmin) => void;
}

export function ModalEditarNegocio({ negocio, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombreNegocio: negocio.tNameCompany,
    nombreAdmin:   negocio.admin?.tNameUser  ?? "",
    emailAdmin:    negocio.admin?.tEmailUser ?? "",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("id",            negocio.eCodCompany);
    formData.append("nombreNegocio", form.nombreNegocio);
    formData.append("nombreAdmin",   form.nombreAdmin);
    formData.append("emailAdmin",    form.emailAdmin);

    const result = await editarNegocio(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.negocio) {
      onEditado({
        ...negocio,
        ...result.negocio,
        admin: negocio.admin
          ? { ...negocio.admin, tNameUser: form.nombreAdmin, tEmailUser: form.emailAdmin }
          : null,
      });
    }
  }

  const deshabilitado =
    !form.nombreNegocio.trim() ||
    !form.nombreAdmin.trim()   ||
    !form.emailAdmin.trim();

  return (
    <Modal
      titulo="Editar negocio"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre del negocio" required>
        <ModalInput
          type="text"
          value={form.nombreNegocio}
          onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Nombre del administrador" required>
        <ModalInput
          type="text"
          value={form.nombreAdmin}
          onChange={(e) => setForm({ ...form, nombreAdmin: e.target.value })}
        />
      </ModalField>

      <ModalField label="Correo del administrador" required>
        <ModalInput
          type="email"
          value={form.emailAdmin}
          onChange={(e) => setForm({ ...form, emailAdmin: e.target.value })}
        />
      </ModalField>
    </Modal>
  );
}