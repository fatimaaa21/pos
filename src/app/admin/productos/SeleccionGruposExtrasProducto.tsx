"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  obtenerGruposParaProducto,
  asignarGrupoAProducto,
  quitarGrupoDeProducto,
} from "@/lib/actions/extras";
import type { GrupoExtraConOpciones } from "@/types";

interface Props {
  eCodProduct: string;
}

type GrupoConAsignacion = GrupoExtraConOpciones & { asignado: boolean };

export function SeleccionGruposExtrasProducto({ eCodProduct }: Props) {
  const [grupos, setGrupos]     = useState<GrupoConAsignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const result = await obtenerGruposParaProducto(eCodProduct);
      if (result.error) setError(result.error);
      else setGrupos(result.grupos ?? []);
      setCargando(false);
    })();
  }, [eCodProduct]);

  async function handleToggle(eCodGrupoExtra: string, asignarlo: boolean) {
    setActualizando(eCodGrupoExtra);
    setError(null);

    const result = asignarlo
      ? await asignarGrupoAProducto(eCodProduct, eCodGrupoExtra)
      : await quitarGrupoDeProducto(eCodProduct, eCodGrupoExtra);

    setActualizando(null);

    if (result.error) { setError(result.error); return; }
    setGrupos((prev) =>
      prev.map((g) => g.eCodGrupoExtra === eCodGrupoExtra ? { ...g, asignado: asignarlo } : g)
    );
  }

  if (cargando) {
    return <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando extras…</p>;
  }

  return (
    <div>
      {grupos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gray)", fontStyle: "italic" }}>
          Todavía no hay grupos de extras creados en el negocio.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {grupos.map((g) => (
            <label
              key={g.eCodGrupoExtra}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                border: `1.5px solid ${g.asignado ? "var(--color-primary)" : "var(--border-default)"}`,
                borderRadius: "var(--radius-md)",
                background: g.asignado ? "var(--color-primary-50)" : "white",
                cursor: actualizando === g.eCodGrupoExtra ? "wait" : "pointer",
                opacity: g.bStateGrupoExtra ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                checked={g.asignado}
                disabled={actualizando === g.eCodGrupoExtra || !g.bStateGrupoExtra}
                onChange={(e) => handleToggle(g.eCodGrupoExtra, e.target.checked)}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>{g.tNombreGrupo}</span>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>
                  {g.opciones.length} opción{g.opciones.length !== 1 ? "es" : ""}
                  {!g.bStateGrupoExtra && " · inactivo"}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      <Link
        href="/admin/extras"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 12, fontWeight: 600, color: "var(--color-primary)",
          marginTop: "var(--space-3)", textDecoration: "none",
        }}
      >
        Administrar grupos y opciones <ExternalLink size={12} />
      </Link>

      {error && (
        <p style={{ fontSize: 12, color: "var(--color-error)", fontWeight: 600, marginTop: "var(--space-2)" }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}