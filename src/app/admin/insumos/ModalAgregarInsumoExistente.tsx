"use client";

import { useEffect, useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { agregarInsumoExistenteASucursal, getInsumosMaestroDisponibles } from "@/lib/actions/insumos";
import type { InsumoConStock, InsumoMaestro } from "@/types";

interface Props {
  onClose:        () => void;
  onAgregado:     (insumo: InsumoConStock) => void;
  fkeCodSucursal: string | null;
  sucursales:     { eCodSucursal: string; tNombre: string }[];
}

export function ModalAgregarInsumoExistente({ onClose, onAgregado, fkeCodSucursal: sucursalProp, sucursales }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(sucursalProp ?? "");
  const [maestrosDisponibles, setMaestrosDisponibles]   = useState<InsumoMaestro[]>([]);
  const [cargandoMaestros, setCargandoMaestros]         = useState(false);

  const [form, setForm] = useState({
    fkeCodInsumoMaestro: "",
    eCostoUnitario:      "",
    eCantidadStock:      "0",
    eStockMinimo:        "0",
  });

  // Recarga la lista de insumos disponibles cada vez que cambia la sucursal
  // elegida — un insumo puede estar disponible en Sucursal B pero no en A
  // si ya se agregó ahí antes.
  useEffect(() => {
    if (!sucursalSeleccionada) {
      setMaestrosDisponibles([]);
      return;
    }
    let cancelled = false;
    async function cargar() {
      setCargandoMaestros(true);
      const data = await getInsumosMaestroDisponibles(sucursalSeleccionada);
      if (!cancelled) {
        setMaestrosDisponibles(data);
        setForm((f) => ({ ...f, fkeCodInsumoMaestro: "" }));
        setCargandoMaestros(false);
      }
    }
    cargar();
    return () => { cancelled = true; };
  }, [sucursalSeleccionada]);

  const maestroElegido = maestrosDisponibles.find((m) => m.eCodInsumoMaestro === form.fkeCodInsumoMaestro);

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("fkeCodInsumoMaestro", form.fkeCodInsumoMaestro);
    fd.append("fkeCodSucursal",      sucursalSeleccionada);
    fd.append("eCostoUnitario",      form.eCostoUnitario || "0");
    fd.append("eCantidadStock",      form.eCantidadStock || "0");
    fd.append("eStockMinimo",        form.eStockMinimo || "0");

    const result = await agregarInsumoExistenteASucursal(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.insumo) {
      onAgregado(result.insumo);
    }
  }

  const deshabilitado = !sucursalSeleccionada || !form.fkeCodInsumoMaestro;

  return (
    <Modal
      titulo="Agregar insumo existente"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar a esta sucursal"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalInfo>
        Usa esto cuando el insumo ya existe en otra sucursal (mismo nombre,
        misma unidad de conversión) y solo necesitas registrar cuánto stock
        hay aquí — sin crear un insumo duplicado.
      </ModalInfo>

      {!sucursalProp && (
        <ModalField label="Sucursal" required>
          <ModalSelect
            value={sucursalSeleccionada}
            onChange={(e) => setSucursalSeleccionada(e.target.value)}
          >
            <option value="">Seleccionar sucursal...</option>
            {sucursales.map((s) => (
              <option key={s.eCodSucursal} value={s.eCodSucursal}>{s.tNombre}</option>
            ))}
          </ModalSelect>
        </ModalField>
      )}

      {sucursalSeleccionada && (
        <ModalField label="Insumo" required>
          <ModalSelect
            value={form.fkeCodInsumoMaestro}
            onChange={(e) => setForm({ ...form, fkeCodInsumoMaestro: e.target.value })}
            disabled={cargandoMaestros}
          >
            <option value="">
              {cargandoMaestros ? "Cargando..." : "Seleccionar insumo..."}
            </option>
            {maestrosDisponibles.map((m) => (
              <option key={m.eCodInsumoMaestro} value={m.eCodInsumoMaestro}>{m.tNombre}</option>
            ))}
          </ModalSelect>
          {!cargandoMaestros && sucursalSeleccionada && maestrosDisponibles.length === 0 && (
            <ModalInfo>
              No hay insumos disponibles para agregar — todos los insumos de
              tu compañía ya tienen stock en esta sucursal, o aún no has
              creado ninguno.
            </ModalInfo>
          )}
        </ModalField>
      )}

      {maestroElegido && (
        <>
          <ModalInfo>
            1 {maestroElegido.tUnidadCompra} de compra = {maestroElegido.eFactorConversion} {maestroElegido.tUnidadReceta} en receta
          </ModalInfo>

          <ModalField label="Costo por unidad de compra (en esta sucursal)">
            <ModalInput
              type="number"
              step="0.01"
              placeholder="Ej. 180.00"
              value={form.eCostoUnitario}
              onChange={(e) => setForm({ ...form, eCostoUnitario: e.target.value })}
            />
          </ModalField>

          <div style={{ display: "flex", gap: 12 }}>
            <ModalField label={`Stock inicial (${maestroElegido.tUnidadReceta})`}>
              <ModalInput
                type="number"
                step="0.01"
                placeholder="0"
                value={form.eCantidadStock}
                onChange={(e) => setForm({ ...form, eCantidadStock: e.target.value })}
              />
            </ModalField>
            <ModalField label={`Stock mínimo (${maestroElegido.tUnidadReceta})`}>
              <ModalInput
                type="number"
                step="0.01"
                placeholder="0"
                value={form.eStockMinimo}
                onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
              />
            </ModalField>
          </div>
        </>
      )}
    </Modal>
  );
}