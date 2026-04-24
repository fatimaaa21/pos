// Página de inicio de sesión

"use client";

import { useState } from "react";
import { login } from "@/lib/actions/auth";
import styles from "./page.module.css";
import modalStyles from "@/components/ui/Modal.module.css";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={modalStyles.card}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "linear-gradient(135deg, #d4a574, #a86530)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, margin: "0 auto 16px",
            boxShadow: "0 8px 24px rgba(193,127,62,0.25)",
          }}>🥐</div>
          <h1 className={modalStyles.title}>Bienvenido</h1>
          <p className={styles.subtitulo}>
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "white", borderRadius: 20, padding: 32,
          border: "1.5px solid #eeebe6",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: "block", fontSize: 13,
                fontWeight: 500, color: "#4a3c34", marginBottom: 6,
              }}>
                Correo electrónico
              </label>
              <input
                type="email"
                name="email"
                placeholder="tu@correo.com"
                required
                autoComplete="email"
                style={{
                  width: "100%", padding: "12px 16px",
                  border: "1.5px solid #e5e0d8", borderRadius: 12,
                  fontSize: 14, color: "#1a1a1a",
                  background: "white", outline: "none",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: "block", fontSize: 13,
                fontWeight: 500, color: "#4a3c34", marginBottom: 6,
              }}>
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 16px",
                  border: "1.5px solid #e5e0d8", borderRadius: 12,
                  fontSize: 14, color: "#1a1a1a",
                  background: "white", outline: "none",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 10, padding: "10px 14px",
                color: "#ef4444", fontSize: 13, marginBottom: 18,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: 13,
                background: loading ? "#9e9590" : "#2d2420",
                color: "white", border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "#9e9590", fontSize: 12, marginTop: 24 }}>
          Sistema de gestión · Panadería
        </p>
      </div>
    </div>
  );
}