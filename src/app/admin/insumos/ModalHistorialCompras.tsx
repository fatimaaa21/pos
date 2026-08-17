"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { obtenerHistorialCompras, obtenerHistorialAjustes } from "@/lib/actions/insumos";

type Movimiento =
  | {
      tipo: "compra";
      id: string;
      tNombreInsumo: string;
      detalle: string;
      fecha: string;
      sucursal: string;
    }
  | {
      tipo: "ajuste";
      id: string;
      tNombreInsumo: string;
      detalle: string;
      motivo: string;
      fecha: string;
      sucursal: string;
    };

interface Props {
  onClose: () => void;
}

export function ModalHistorialCompras({ onClose }: Props) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando]       = useState(true);

  useEffect(() => {
    Promise.all([obtenerHistorialCompras(), obtenerHistorialAjustes()]).then(([compras, ajustes]) => {
      const compraItems: Movimiento[] = compras.map((c) => ({
        tipo: "compra",
        id: c.eCodCompra,
        tNombreInsumo: c.tNombreInsumoSnapshot,
        detalle: `+${c.eCantidadComprada} ${c.tUnidadCompraSnapshot}`,
        fecha: c.fhCreateCompra,
        sucursal: c.tNombreSucursal,
      }));

      const ajusteItems: Movimiento[] = ajustes.map((a) => ({
        tipo: "ajuste",
        id: a.eCodAjuste,
        tNombreInsumo: a.tNombreInsumoSnapshot,
        detalle: `${a.eCantidadAjuste > 0 ? "+" : ""}${a.eCantidadAjuste} ${a.tUnidadRecetaSnapshot}`,
        motivo: a.tMotivo,
        fecha: a.fhCreateAjuste,
        sucursal: a.tNombreSucursal,
      }));

      const todos = [...compraItems, ...ajusteItems].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      setMovimientos(todos);
      setCargando(false);
    });
  }, []);

  return (
    <Modal titulo="Historial de movimientos" onCerrar={onClose} labelCancelar="Cerrar" ancho="md">
      {cargando ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando…</p>
      ) : movimientos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>
          Todavía no hay movimientos registrados — aparecen aquí cuando confirmas
          una compra o haces un ajuste manual de stock.
        </p>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {movimientos.map((m) => (
            <div
              key={`${m.tipo}-${m.id}`}
              style={{ padding: "8px 4px", borderBottom: "1px solid var(--border-default, #f5f5f5)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge variante={m.tipo === "compra" ? "disponible" : "bajo"}>
                    {m.tipo === "compra" ? "Compra" : "Ajuste"}
                  </Badge>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.tNombreInsumo}</span>
                </div>
                <span style={{ fontSize: 13 }}>{m.detalle}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}>
                {new Date(m.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                {" · "}{m.sucursal}
                {m.tipo === "ajuste" && ` · ${m.motivo}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}