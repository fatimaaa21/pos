"use client";

import { useState } from "react";
import { Modal, ModalField, ModalSelect } from "@/components/ui/Modal";
import { obtenerInsumosParaListaCompra, confirmarCompraInsumos } from "@/lib/actions/insumos";
import { FileDown, FileSpreadsheet, X, Check } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import toast from "react-hot-toast";

interface ItemLista {
  eCodInsumoStock:   string;
  tNombre:           string;
  tUnidadCompra:     string;
  tUnidadReceta:     string;
  eFactorConversion: number;
  eCantidadStock:    number;
  eStockMinimo:      number;
  tNombreSucursal:   string;
  eCantidadAComprar: number; // editable, precargado con el déficit exacto
}

interface Props {
  onClose:        () => void;
  fkeCodSucursal: string | null; // sucursal actual del contexto, preselección si existe
  sucursales:     { eCodSucursal: string; tNombre: string }[];
  negocioNombre:  string;
  negocioLogoUrl: string | null;
}

export function ModalListaCompra({ onClose, fkeCodSucursal, sucursales, negocioNombre, negocioLogoUrl }: Props) {
  const [alcance, setAlcance] = useState<"actual" | "todas">(fkeCodSucursal ? "actual" : "todas");
  const [sucursalElegida, setSucursalElegida] = useState(fkeCodSucursal ?? sucursales[0]?.eCodSucursal ?? "");
  const [items, setItems]       = useState<ItemLista[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [descargandoPDF, setDescargandoPDF] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleGenerar() {
    setCargando(true);
    setError(null);

    const resultado = await obtenerInsumosParaListaCompra(
      alcance,
      alcance === "actual" ? sucursalElegida : undefined
    );

    if (resultado.length === 0) {
      setError("No hay insumos con stock por debajo del mínimo — no hace falta comprar nada por ahora.");
      setItems(null);
      setCargando(false);
      return;
    }

    setItems(
      resultado.map((r) => ({
        ...r,
        // Déficit exacto en unidad de compra — punto de partida, no una
        // sugerencia "inteligente". El admin lo ajusta antes de descargar.
        eCantidadAComprar: Math.max(
          0,
          Math.round(((r.eStockMinimo - r.eCantidadStock) / r.eFactorConversion) * 100) / 100
        ),
      }))
    );
    setCargando(false);
  }

  function actualizarCantidad(eCodInsumoStock: string, valor: string) {
    const num = parseFloat(valor);
    setItems((prev) =>
      prev
        ? prev.map((i) =>
            i.eCodInsumoStock === eCodInsumoStock
              ? { ...i, eCantidadAComprar: isNaN(num) ? 0 : num }
              : i
          )
        : prev
    );
  }

  function quitarDeLista(eCodInsumoStock: string) {
    setItems((prev) => (prev ? prev.filter((i) => i.eCodInsumoStock !== eCodInsumoStock) : prev));
  }

  async function handleConfirmarCompra() {
    if (!items || items.length === 0) return;

    const aConfirmar = items.filter((i) => i.eCantidadAComprar > 0);
    if (aConfirmar.length === 0) {
      toast.error("No hay cantidades mayores a 0 para confirmar");
      return;
    }

    setConfirmando(true);
    const resultado = await confirmarCompraInsumos(
      aConfirmar.map((i) => ({ eCodInsumoStock: i.eCodInsumoStock, eCantidadComprada: i.eCantidadAComprar }))
    );
    setConfirmando(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }

    if (resultado.errores.length > 0) {
      resultado.errores.forEach((e) => toast.error(e));
    }
    if (resultado.actualizados > 0) {
      toast.success(
        `Stock actualizado: ${resultado.actualizados} insumo${resultado.actualizados !== 1 ? "s" : ""}`
      );
    }

    // Solo cierra si TODO salió bien — si hubo errores parciales, deja el
    // modal abierto para que el admin vea qué falló y decida si reintenta.
    if (resultado.errores.length === 0) {
      onClose();
    }
  }

  // Carga el logo remoto y lo convierte a PNG base64 vía canvas — jsPDF no
  // acepta URLs directas ni todos los formatos de imagen tal cual. Si falla
  // (CORS del bucket, sin logo, red caída), regresa null y el PDF se genera
  // igual, solo sin logo — nunca bloquea la descarga por esto.
  async function cargarLogoComoPNG(url: string): Promise<{ dataUrl: string; ratio: number } | null> {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return { dataUrl: canvas.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
    } catch {
      return null;
    }
  }

  async function handleDescargarPDF() {
    if (!items) return;
    setDescargandoPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
    const autoTable  = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    const anchoPagina = doc.internal.pageSize.getWidth();
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const subtitulo = alcance === "todas" ? "Lista de compra — todas las sucursales" : "Lista de compra";

    // ── Banda de encabezado con color de marca ──────────────────────────────
    const [r, g, b] = [98, 131, 33]; // var(--color-primary) aproximado
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, anchoPagina, 32, "F");

    const logo = negocioLogoUrl ? await cargarLogoComoPNG(negocioLogoUrl) : null;
    let xTexto = 14;

    if (logo) {
      const altoLogo = 18;
      const anchoLogo = altoLogo * logo.ratio;
      doc.addImage(logo.dataUrl, "PNG", 14, 7, anchoLogo, altoLogo);
      xTexto = 14 + anchoLogo + 6;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("Sora", "bold");
    doc.text(negocioNombre, xTexto, 15);
    doc.setFontSize(10);
    doc.setFont("Sora", "normal");
    doc.text(subtitulo, xTexto, 22);
    doc.text(fecha, xTexto, 27);

    autoTable(doc, {
      startY: 40,
      head: [
        alcance === "todas"
          ? ["Insumo", "Sucursal", "Stock actual", "Mínimo", "Comprar"]
          : ["Insumo", "Stock actual", "Mínimo", "Comprar"],
      ],
      body: items.map((i) =>
        alcance === "todas"
          ? [
              i.tNombre,
              i.tNombreSucursal,
              `${i.eCantidadStock} ${i.tUnidadReceta}`,
              `${i.eStockMinimo} ${i.tUnidadReceta}`,
              `${i.eCantidadAComprar} ${i.tUnidadCompra}`,
            ]
          : [
              i.tNombre,
              `${i.eCantidadStock} ${i.tUnidadReceta}`,
              `${i.eStockMinimo} ${i.tUnidadReceta}`,
              `${i.eCantidadAComprar} ${i.tUnidadCompra}`,
            ]
      ),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [r, g, b], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 248, 242] },
      theme: "striped",
      margin: { left: 14, right: 14 },
      // Pie de página de marca del sistema, repetido en cada página si la
      // tabla se corta en varias.
      didDrawPage: () => {
        const alto = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont("Sora", "normal");
        doc.text("Generado con Kivi · kivi.mx", 14, alto - 10);
      },
    });

    doc.save(`lista-compra-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setDescargandoPDF(false);
    }
  }

  async function handleDescargarExcel() {
    if (!items) return;
    const XLSX = await import("xlsx");

    const filas = items.map((i) => ({
      Insumo: i.tNombre,
      ...(alcance === "todas" ? { Sucursal: i.tNombreSucursal } : {}),
      "Stock actual": `${i.eCantidadStock} ${i.tUnidadReceta}`,
      "Mínimo": `${i.eStockMinimo} ${i.tUnidadReceta}`,
      Comprar: i.eCantidadAComprar,
      Unidad: i.tUnidadCompra,
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lista de compra");
    XLSX.writeFile(wb, `lista-compra-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <Modal
      titulo="Lista de compra"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      error={error}
      ancho="sm"
    >
      {!items && (
        <>
          <ModalField label="Alcance">
            <ModalSelect value={alcance} onChange={(e) => setAlcance(e.target.value as "actual" | "todas")}>
              <option value="actual">Una sucursal específica</option>
              <option value="todas">Todas las sucursales</option>
            </ModalSelect>
          </ModalField>

          {alcance === "actual" && (
            <ModalField label="Sucursal">
              <ModalSelect value={sucursalElegida} onChange={(e) => setSucursalElegida(e.target.value)}>
                {sucursales.map((s) => (
                  <option key={s.eCodSucursal} value={s.eCodSucursal}>{s.tNombre}</option>
                ))}
              </ModalSelect>
            </ModalField>
          )}

          <button
            onClick={handleGenerar}
            disabled={cargando || (alcance === "actual" && !sucursalElegida)}
            style={{
              marginTop: 8, height: 36, padding: "0 16px", border: "none", borderRadius: 6,
              background: "var(--color-primary, #628321)", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", width: "100%",
            }}
          >
            {cargando ? <Spinner /> : "Generar lista"}
          </button>
        </>
      )}

      {items && items.length > 0 && (
        <>
          <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-default, #eee)" }}>
                  <th style={{ padding: "6px 4px" }}>Insumo</th>
                  {alcance === "todas" && <th style={{ padding: "6px 4px" }}>Sucursal</th>}
                  <th style={{ padding: "6px 4px" }}>Stock / Mínimo</th>
                  <th style={{ padding: "6px 4px" }}>Comprar</th>
                  <th style={{ padding: "6px 4px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.eCodInsumoStock} style={{ borderBottom: "1px solid var(--border-default, #f5f5f5)" }}>
                    <td style={{ padding: "6px 4px" }}>{i.tNombre}</td>
                    {alcance === "todas" && <td style={{ padding: "6px 4px", color: "var(--gray)" }}>{i.tNombreSucursal}</td>}
                    <td style={{ padding: "6px 4px", color: "var(--gray)", fontSize: 12 }}>
                      {i.eCantidadStock} / {i.eStockMinimo} {i.tUnidadReceta}
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={i.eCantidadAComprar}
                        onChange={(e) => actualizarCantidad(i.eCodInsumoStock, e.target.value)}
                        style={{ width: 64, fontSize: 13, padding: "3px 4px" }}
                      />
                      <span style={{ fontSize: 12, color: "var(--gray)", marginLeft: 4 }}>{i.tUnidadCompra}</span>
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <button
                        onClick={() => quitarDeLista(i.eCodInsumoStock)}
                        title="Quitar de la lista"
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--gray)", display: "flex", padding: 2 }}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleDescargarPDF}
              disabled={descargandoPDF}
              style={{
                display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px",
                border: "1px solid var(--border-default, #ddd)", borderRadius: 6, background: "#fff",
                cursor: descargandoPDF ? "default" : "pointer", fontSize: 13,
              }}
            >
              {descargandoPDF ? <Spinner /> : (<><FileDown size={15} /> Descargar PDF</>)}
            </button>
            <button
              onClick={handleDescargarExcel}
              style={{
                display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px",
                border: "1px solid var(--border-default, #ddd)", borderRadius: 6, background: "#fff",
                cursor: "pointer", fontSize: 13,
              }}
            >
              <FileSpreadsheet size={15} /> Descargar Excel
            </button>
          </div>

          <hr style={{ margin: "16px 0", opacity: 0.2 }} />

          <p style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>
            ¿Ya compraste esto? Ajusta las cantidades arriba a lo que realmente
            compraste y confirma — actualiza el stock de inmediato y queda
            registrado en el historial. No lo hagas antes de comprar de verdad.
          </p>

          <button
            onClick={handleConfirmarCompra}
            disabled={confirmando}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              height: 36, width: "100%", padding: "0 14px", border: "none", borderRadius: 6,
              background: "var(--color-primary, #628321)", color: "#fff",
              cursor: confirmando ? "default" : "pointer", fontSize: 13, fontWeight: 700,
            }}
          >
            {confirmando ? <Spinner /> : (<><Check size={15} /> Confirmar compra y actualizar stock</>)}
          </button>
        </>
      )}

      {items && items.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>
          Quitaste todos los insumos de la lista — no hay nada que descargar.
        </p>
      )}
    </Modal>
  );
}