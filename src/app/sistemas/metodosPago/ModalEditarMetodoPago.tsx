"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { editarMetodoPago, type MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./metodosPago.module.css";

const ICONOS_DISPONIBLES = [
  { value: "Banknote",   label: "Billete (Efectivo)" },
  { value: "CreditCard", label: "Tarjeta" },
  { value: "Smartphone", label: "Celular (QR / Transfer)" },
  { value: "Wallet",     label: "Cartera" },
  { value: "Building2",  label: "Banco" },
  { value: "QrCode",     label: "QR" },
  { value: "Bitcoin",    label: "Cripto" },
  { value: "Receipt",    label: "Recibo" },
];

function IconoMetodo({ nombre, size = 18 }: { nombre: string; size?: number }) {
  const Icono = (Icons as any)[nombre];
  return Icono ? <Icono size={size} /> : <Icons.CreditCard size={size} />;
}

interface FormState {
  tNamePay:    string;
  tIconPay:    string;
  descripcion: string;
  orden:       string;
}

interface Props {
  metodo:    MetodoPagoGlobal;
  onClose:   () => void;
  onEditado: (metodo: MetodoPagoGlobal) => void;
}

export function ModalEditarMetodoPago({ metodo, onClose, onEditado }: Props) {
  const [form, setForm] = useState<FormState>({
    tNamePay:    metodo.tNamePay,
    tIconPay:    metodo.tIconPay,
    descripcion: metodo.descripcion ?? "",
    orden:       String(metodo.orden),
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodPay",     metodo.eCodPay);
    fd.append("tNamePay",    form.tNamePay);
    fd.append("tIconPay",    form.tIconPay);
    fd.append("descripcion", form.descripcion);
    fd.append("orden",       form.orden);

    const result = await editarMetodoPago(fd);
    setLoading(false);

    if (result?.error) { setError(result.error); return; }
    onEditado(result.metodo!);
  }

  return (
    <Modal
      titulo="Editar método de pago"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={!form.tNamePay.trim()}
      error={error}
      ancho="sm"
    >
      {/* Preview */}
      <div className={styles.iconoPreview}>
        <div className={styles.iconoPreviewIcon}>
          <IconoMetodo nombre={form.tIconPay} size={24} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            {form.tNamePay || "Nombre del método"}
          </p>
        </div>
      </div>

      <ModalField label="Nombre" required>
        <ModalInput
          type="text"
          value={form.tNamePay}
          onChange={(e) => setForm((p) => ({ ...p, tNamePay: e.target.value }))}
          autoFocus
        />
      </ModalField>

      <ModalField label="Ícono">
        <ModalSelect
          value={form.tIconPay}
          onChange={(e) => setForm((p) => ({ ...p, tIconPay: e.target.value }))}
        >
          {ICONOS_DISPONIBLES.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </ModalSelect>
      </ModalField>

      <ModalField label="Descripción">
        <ModalInput
          type="text"
          placeholder="Ej. Pago en efectivo en caja"
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
        />
      </ModalField>

      <ModalField label="Orden de aparición">
        <ModalInput
          type="number"
          min={0}
          value={form.orden}
          onChange={(e) => setForm((p) => ({ ...p, orden: e.target.value }))}
        />
      </ModalField>
    </Modal>
  );
}