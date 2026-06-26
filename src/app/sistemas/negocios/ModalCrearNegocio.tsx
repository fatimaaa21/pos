"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { crearNegocio } from "@/lib/actions/sistemas";
import { Building2 } from "lucide-react";
import type { Perfil } from "@/types";
import type { NegocioConAdmin } from "./NegociosClient";

interface Props {
  onClose: () => void;
  onCreado: (negocio: NegocioConAdmin, perfil: Perfil, codigo: string) => void;
}

export function ModalCrearNegocio({ onClose, onCreado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombreNegocio: "",
    nombreAdmin:   "",
    emailAdmin:    "",
    tipo_negocio:  "general" as "general" | "impresion" | "billar",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("nombreNegocio", form.nombreNegocio);
    formData.append("nombreAdmin",   form.nombreAdmin);
    formData.append("emailAdmin",    form.emailAdmin);
    formData.append("tipo_negocio",  form.tipo_negocio);

    const result = await crearNegocio(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.negocio && result?.perfil && result?.codigo) {
      onCreado(result.negocio as NegocioConAdmin, result.perfil as Perfil, result.codigo);
    }
  }

  const deshabilitado =
    !form.nombreNegocio.trim() ||
    !form.nombreAdmin.trim()   ||
    !form.emailAdmin.trim();

  return (
    <Modal
      titulo="Nuevo negocio"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Crear negocio"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre del negocio" required>
        <ModalInput
          type="text"
          placeholder="Ej. Panadería El Trigal"
          value={form.nombreNegocio}
          onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Nombre del administrador" required>
        <ModalInput
          type="text"
          placeholder="Ej. María García"
          value={form.nombreAdmin}
          onChange={(e) => setForm({ ...form, nombreAdmin: e.target.value })}
        />
      </ModalField>

      <ModalField label="Correo del administrador" required>
        <ModalInput
          type="email"
          placeholder="correo@negocio.com"
          value={form.emailAdmin}
          onChange={(e) => setForm({ ...form, emailAdmin: e.target.value })}
        />
      </ModalField>

      <ModalField label="Tipo de negocio" required>
        <ModalSelect
          value={form.tipo_negocio}
          onChange={(e) =>
            setForm({ ...form, tipo_negocio: e.target.value as "general" | "impresion" | "billar" })
          }
        >
          <option value="general">General (panadería, café, fonda...)</option>
          <option value="impresion">Impresión y diseño (lonas, material gráfico...)</option>
          <option value="billar">Billar (cobro por tiempo de mesa)</option>
        </ModalSelect>
      </ModalField>

      <ModalInfo>
        <Building2 size={16} />
        Se generará un código de 4 dígitos que se mostrará al terminar.
      </ModalInfo>
    </Modal>
  );
}