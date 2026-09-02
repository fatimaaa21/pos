"use client";

import { useState } from "react";
import { recuperarUrlPorCorreo } from "@/lib/actions/recuperarUrl";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import styles from "@/components/auth/PinLoginForm.module.css";
import modal from "@/components/ui/Modal.module.css";

export default function RecuperarUrlPage() {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMensaje(null);
    const result = await recuperarUrlPorCorreo(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setMensaje(result.mensaje ?? null);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.cardWrapper}>
        <div className={modal.card}>
          <div style={{ textAlign: "center" }}>
            <div className={styles.logo}>
              <img src="/kivi-logo.svg" alt="Kivi" />
            </div>
            <h1 className={modal.title}>Recuperar URL de acceso</h1>
            <p className={styles.subtitulo}>
              Escribe el correo con el que te registraste como administrador
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px" }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              disabled={loading || !!mensaje}
              style={{
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-primary)",
                fontSize: 15,
                fontFamily: "var(--font-family)",
              }}
            />

            <button
              type="submit"
              disabled={loading || !!mensaje}
              className={`${modal.btnAccion} ${modal.btnPrimario}`}
              style={{ width: "100%", minHeight: 40 }}
            >
              {loading ? <Spinner size={18} /> : "Enviar"}
            </button>

            {mensaje && (
              <p style={{ color: "var(--color-primary)", fontSize: 13, textAlign: "center" }}>{mensaje}</p>
            )}
            {error && <div className={styles.error}>⚠️ {error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}