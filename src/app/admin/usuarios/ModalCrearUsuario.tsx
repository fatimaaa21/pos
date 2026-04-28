"use client";

import { useState } from "react";
import type { Perfil } from "@/types";
import { crearUsuario } from "@/lib/actions/usuarios";

interface Props {
  onClose: () => void;
  onCreado: (perfil: Perfil) => void;
}

export function ModalCrearUsuario({ onClose, onCreado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameUser: "",
    tEmailUser: "",
    tRolUser: "empleado" as "admin" | "empleado",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("tNameUser", form.tNameUser);
    formData.append("tEmailUser", form.tEmailUser);
    formData.append("tRolUser", form.tRolUser);

    const result = await crearUsuario(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.perfil) {
      onCreado(result.perfil);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <ModalHeader title="Nuevo usuario" onClose={onClose} />

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Nombre completo">
            <input
              required
              value={form.tNameUser}
              onChange={(e) => setForm({ ...form, tNameUser: e.target.value })}
              placeholder="Ej. María García"
              style={inputStyle}
            />
          </Field>

          <Field label="Correo electrónico">
            <input
              required
              type="email"
              value={form.tEmailUser}
              onChange={(e) => setForm({ ...form, tEmailUser: e.target.value })}
              placeholder="correo@ejemplo.com"
              style={inputStyle}
            />
          </Field>

          <Field label="Rol">
            <select
              value={form.tRolUser}
              onChange={(e) => setForm({ ...form, tRolUser: e.target.value as "admin" | "empleado" })}
              style={inputStyle}
            >
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </Field>

          <div style={{
            background: "#f0f5e8", borderRadius: 10,
            padding: "12px 14px", fontSize: 13, color: "#4a6318",
            border: "1px solid #d4e6a0",
          }}>
            📧 Se generará un código de 4 dígitos y se enviará al correo del empleado automáticamente.
          </div>

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px",
              color: "#dc2626", fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ ...btnBase, flex: 1, background: "white", border: "1.5px solid #e5e0d8", color: "#7a6a5e" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ ...btnBase, flex: 2, background: "linear-gradient(135deg, #628321, #4a6318)", color: "white", border: "none", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

// --- Helpers de UI ---

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        background: "white", borderRadius: 20,
        padding: 28, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
      }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
        {title}
      </h2>
      <button
        onClick={onClose}
        style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e0d8", background: "#fafaf9", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        ×
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#4a4a4a" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #e5e0d8",
  fontSize: 14,
  color: "#1a1a1a",
  background: "white",
  outline: "none",
  fontFamily: "'DM Sans', sans-serif",
  width: "100%",
};

const btnBase: React.CSSProperties = {
  padding: "11px 20px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
};