"use client";

import { useEffect, useState, useTransition } from "react";
import { LayoutGrid, ChefHat } from "lucide-react";
import { Modal }         from "@/components/ui/Modal";
import { obtenerModulosNegocio, toggleModuloNegocio } from "@/lib/actions/sistemas";
import type { NegocioConAdmin } from "./NegociosClient";

const LABEL: Record<string, string> = {
  mesas: "Layout de mesas",
  cocina:  "Pantalla de cocina",
};

interface Props {
  negocio: NegocioConAdmin;
  onClose: () => void;
}

export function ModalModulosNegocio({ negocio, onClose }: Props) {
  const [modulos,    setModulos]    = useState<{ tModulo: string; bStateModulo: boolean }[]>([]);
  const [cargando,   setCargando]   = useState(true);
  const [isPending,  startTransition] = useTransition();

  useEffect(() => {
    obtenerModulosNegocio(negocio.eCodCompany).then((data) => {
      setModulos(data);
      setCargando(false);
    });
  }, [negocio.eCodCompany]);

  function handleToggle(tModulo: string, actual: boolean) {
    startTransition(async () => {
      const result = await toggleModuloNegocio(negocio.eCodCompany, tModulo, !actual);
      if ("error" in result) return;
      setModulos((prev) =>
        prev.map((m) => m.tModulo === tModulo ? { ...m, bStateModulo: !actual } : m)
      );
    });
  }

  return (
    <Modal
      titulo={`Módulos — ${negocio.tNameCompany}`}
      onCerrar={onClose}
      sinFooter
      ancho="sm"
    >
      {cargando ? (
        <p style={{ fontSize: 13, color: "var(--gray)", textAlign: "center", padding: "var(--space-4) 0" }}>
          Cargando módulos...
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {modulos.map((m) => (
            <div
              key={m.tModulo}
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "var(--space-3) var(--space-4)",
                border:         `1px solid ${m.bStateModulo ? "var(--color-primary-light)" : "var(--border-default)"}`,
                borderRadius:   "var(--radius-md)",
                background:     m.bStateModulo ? "var(--color-primary-50)" : "var(--white)",
                transition:     "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                {m.tModulo === "cocina"
                  ? <ChefHat   size={16} color={m.bStateModulo ? "var(--color-primary)" : "var(--gray)"} />
                  : <LayoutGrid size={16} color={m.bStateModulo ? "var(--color-primary)" : "var(--gray)"} />
                }
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", margin: 0 }}>
                    {LABEL[m.tModulo] ?? m.tModulo}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--gray)", margin: "2px 0 0" }}>
                    {m.bStateModulo ? "Activo" : "Inactivo"}
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => handleToggle(m.tModulo, m.bStateModulo)}
                disabled={isPending}
                style={{
                  width:      38,
                  height:     22,
                  borderRadius: 11,
                  border:     "none",
                  background: m.bStateModulo ? "var(--color-primary)" : "var(--border-strong)",
                  position:   "relative",
                  cursor:     isPending ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                  opacity:    isPending ? 0.6 : 1,
                }}
                aria-label={`${m.bStateModulo ? "Desactivar" : "Activar"} ${LABEL[m.tModulo] ?? m.tModulo}`}
              >
                <span style={{
                  position:     "absolute",
                  top:          3,
                  left:         m.bStateModulo ? 18 : 3,
                  width:        16,
                  height:       16,
                  borderRadius: "50%",
                  background:   "white",
                  transition:   "left 0.18s",
                  boxShadow:    "0 1px 3px rgba(0,0,0,.2)",
                }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}