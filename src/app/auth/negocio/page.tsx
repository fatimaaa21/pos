"use client";

import { useState } from "react";
import { buscarYRedirigirNegocio } from "@/lib/actions/negocioLookup";

export default function BuscarNegocioPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [valor, setValor] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await buscarYRedirigirNegocio(valor);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // Si no hay error, la acción ya redirigió.
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}
      >
        <h1 style={{ textAlign: "center", fontSize: 20 }}>¿Cuál es tu negocio?</h1>
        <p style={{ textAlign: "center", color: "var(--gray)", fontSize: 14 }}>
          Escribe el nombre o identificador de tu negocio para llegar a tu pantalla de acceso.
        </p>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Nombre de tu negocio"
          disabled={loading}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid var(--color-primary)",
          }}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Buscando..." : "Continuar"}
        </button>
        {error && (
          <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center" }}>{error}</p>
        )}
      </form>
    </div>
  );
}