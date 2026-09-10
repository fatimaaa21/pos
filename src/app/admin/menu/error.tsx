"use client";

// ARCHIVO TEMPORAL DE DIAGNÓSTICO — bórralo en cuanto encontremos el bug.
// Next.js renderiza esto automáticamente cuando algo truena dentro de
// /admin/menu, y nos da el error real con su stack — sin depender de que
// el overlay de Chrome decida mostrarlo o no.

import { useEffect } from "react";

export default function AdminMenuError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // También lo mandamos a consola por si acaso, con el objeto completo.
    console.error("[DIAGNÓSTICO /admin/menu]", error);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h2 style={{ color: "#c00" }}>Error capturado en /admin/menu</h2>
      <p><strong>Mensaje:</strong> {error.message}</p>
      {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
      <p><strong>Stack completo:</strong></p>
      <pre style={{
        whiteSpace: "pre-wrap",
        background: "#f5f5f5",
        padding: 12,
        borderRadius: 6,
        border: "1px solid #ddd",
        maxHeight: "70vh",
        overflow: "auto",
      }}>
        {error.stack ?? "(sin stack disponible)"}
      </pre>
    </div>
  );
}