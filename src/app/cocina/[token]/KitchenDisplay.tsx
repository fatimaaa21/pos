"use client";

// src/app/cocina/[token]/KitchenDisplay.tsx
// Pantalla de cocina: muestra pedidos pendientes agrupados por mesa.
// Polling cada 8 segundos al Route Handler /api/cocina/[token].
// Sin autenticación de usuario — solo token en la URL.

import { useState, useEffect, useCallback } from "react";
import { ChefHat, CheckCheck, Clock }       from "lucide-react";
import styles from "./cocina.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemPendiente {
  eCodDetalle:         string;
  tNameProduct:        string;
  tNombrePresentacion: string | null;
  eCantidad:           number;
  fhAgregado:          string;
}

interface GrupoMesa {
  eCodMesa:    string;
  tNombreMesa: string;
  eCodOrden:   string;
  items:       ItemPendiente[];
}

interface Props {
  token:           string;
  tNombreSucursal: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tiempoTranscurrido(fhAgregado: string): string {
  const diff     = Math.max(0, Date.now() - new Date(fhAgregado).getTime());
  const totalSeg = Math.floor(diff / 1000);
  const min      = Math.floor(totalSeg / 60);
  const seg      = totalSeg % 60;
  if (min === 0) return `${seg}s`;
  return `${min}m ${String(seg).padStart(2, "0")}s`;
}

function esUrgente(fhAgregado: string): boolean {
  const diff = Date.now() - new Date(fhAgregado).getTime();
  return diff > 10 * 60 * 1000; // más de 10 minutos
}

// ── Componente ────────────────────────────────────────────────────────────────

export function KitchenDisplay({ token, tNombreSucursal }: Props) {
  const [grupos,     setGrupos]     = useState<GrupoMesa[]>([]);
  const [cargando,   setCargando]   = useState(true);
  const [marcando,   setMarcando]   = useState<Set<string>>(new Set());
  const [ahora,      setAhora]      = useState(new Date());

  // ── Timer para actualizar tiempos mostrados ───────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch de pedidos pendientes ───────────────────────────────────────────
  const fetchPedidos = useCallback(async () => {
    try {
      const res  = await fetch(`/api/cocina/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (json.data) setGrupos(json.data);
    } catch {
      // silencioso — próximo poll lo reintenta
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPedidos();
    const id = setInterval(fetchPedidos, 8000);
    return () => clearInterval(id);
  }, [fetchPedidos]);

  // ── Marcar item como listo ────────────────────────────────────────────────
  async function handleListo(eCodDetalle: string) {
    setMarcando((prev) => new Set(prev).add(eCodDetalle));
    try {
      await fetch(`/api/cocina/${token}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ eCodDetalle }),
      });
      // Actualizar estado local inmediatamente
      setGrupos((prev) =>
        prev
          .map((g) => ({
            ...g,
            items: g.items.filter((i) => i.eCodDetalle !== eCodDetalle),
          }))
          .filter((g) => g.items.length > 0)
      );
    } finally {
      setMarcando((prev) => {
        const next = new Set(prev);
        next.delete(eCodDetalle);
        return next;
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <ChefHat size={22} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Cocina</span>
          <span className={styles.headerSucursal}>{tNombreSucursal}</span>
        </div>
        <span className={styles.headerHora}>
          {ahora.toLocaleTimeString("es-MX", {
            hour:   "2-digit",
            minute: "2-digit",
          })}
        </span>
      </header>

      {/* Contenido */}
      <main className={styles.main}>
        {cargando ? (
          <div className={styles.estadoVacio}>
            <div className={styles.spinner} />
            <p>Cargando pedidos…</p>
          </div>
        ) : grupos.length === 0 ? (
          <div className={styles.estadoVacio}>
            <CheckCheck size={48} strokeWidth={1.2} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Sin pedidos pendientes</p>
            <p className={styles.emptySub}>Los pedidos aparecen aquí en automático</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {grupos.map((grupo) => (
              <div key={grupo.eCodMesa} className={styles.card}>
                {/* Header de la tarjeta */}
                <div className={styles.cardHeader}>
                  <span className={styles.cardMesa}>{grupo.tNombreMesa}</span>
                  <span className={styles.cardCount}>
                    {grupo.items.length} {grupo.items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Lista de items */}
                <ul className={styles.itemList}>
                  {grupo.items.map((item) => {
                    const urgente   = esUrgente(item.fhAgregado);
                    const pendiente = marcando.has(item.eCodDetalle);

                    return (
                      <li
                        key={item.eCodDetalle}
                        className={[
                          styles.item,
                          urgente ? styles.itemUrgente : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className={styles.itemInfo}>
                          <span className={styles.itemCantidad}>
                            ×{item.eCantidad}
                          </span>
                          <div className={styles.itemNombres}>
                            <span className={styles.itemNombre}>
                              {item.tNameProduct}
                            </span>
                            {item.tNombrePresentacion && (
                              <span className={styles.itemPresentacion}>
                                {item.tNombrePresentacion}
                              </span>
                            )}
                          </div>
                          <div className={styles.itemTiempo}>
                            <Clock size={11} />
                            <span>{tiempoTranscurrido(item.fhAgregado)}</span>
                          </div>
                        </div>

                        <button
                          className={styles.btnListo}
                          onClick={() => handleListo(item.eCodDetalle)}
                          disabled={pendiente}
                        >
                          {pendiente ? "…" : "Listo"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}