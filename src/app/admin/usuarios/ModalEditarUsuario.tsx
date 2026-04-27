"use client";

import { useState } from "react";
import type { Perfil } from "@/types";
import { editarUsuario } from "@/lib/actions/usuarios";

interface Props {
  usuario: Perfil;
  onClose: () => void;
  onEditado: (perfil: Perfil) => void;
}

export function ModalEditarUsuario({ usuario, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameUser: usuario.tNameUser,
    tEmailUser: usuario.tEmailUser,
    tRolUser: usuario.tRolUser,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodUser", usuario.eCodUser);
    formData.append("tNameUser", form.tNameUser);
    formData.append("tEmailUser", form.tEmailUser);
    formData.append("tRolUser", form.tRolUser);

    const result = await editarUsuario(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.perfil) {
      onEditado(result.perfil);
    }
  }

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
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
            Editar usuario
          </h2>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e0d8", background: "#fafaf9", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#4a4a4a" }}>Nombre completo</label>
            <input
              required
              value={form.tNameUser}
              onChange={(e) => setForm({ ...form, tNameUser: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#4a4a4a" }}>Correo electrónico</label>
            <input
              required
              type="email"
              value={form.tEmailUser}
              onChange={(e) => setForm({ ...form, tEmailUser: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#4a4a4a" }}>Rol</label>
            <select
              value={form.tRolUser}
              onChange={(e) => setForm({ ...form, tRolUser: e.target.value as "admin" | "empleado" })}
              style={inputStyle}
            >
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
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
              style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #e5e0d8", background: "white", color: "#7a6a5e", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #628321, #4a6318)", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
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