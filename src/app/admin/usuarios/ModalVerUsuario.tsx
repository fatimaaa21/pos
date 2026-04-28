"use client";

import type { Perfil } from "@/types";

interface Props {
  usuario: Perfil;
  onClose: () => void;
}

export function ModalVerUsuario({ usuario, onClose }: Props) {
  const iniciales = usuario.tNameUser
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const campos = [
    { label: "Nombre completo", valor: usuario.tNameUser },
    { label: "Correo electrónico", valor: usuario.tEmailUser },
    { label: "Rol", valor: usuario.tRolUser },
    { label: "Código de acceso", valor: usuario.eCodeUser ?? "—" },
    { label: "Estado", valor: usuario.bStateUser ? "Activo" : "Inactivo" },
    {
      label: "Fecha de creación",
      valor: new Date(usuario.fhCreateUser).toLocaleDateString("es-MX", {
        day: "2-digit", month: "long", year: "numeric",
      }),
    },
  ];

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
        padding: 28, width: "100%", maxWidth: 400,
        boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
            Detalle de usuario
          </h2>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e0d8", background: "#fafaf9", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: usuario.tRolUser === "admin"
              ? "linear-gradient(135deg, #d4a574, #a86530)"
              : "linear-gradient(135deg, #a8c97a, #628321)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 22, fontWeight: 700,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            marginBottom: 10,
          }}>
            {iniciales}
          </div>
          <span style={{
            padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: usuario.bStateUser ? "#f0fdf4" : "#fef2f2",
            color: usuario.bStateUser ? "#16a34a" : "#dc2626",
          }}>
            {usuario.bStateUser ? "● Activo" : "● Inactivo"}
          </span>
        </div>

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campos.map(({ label, valor }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: 10, background: "#f8f7f4",
            }}>
              <span style={{ fontSize: 12, color: "#9a8a7e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {label}
              </span>
              <span style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 500 }}>
                {valor}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 20,
            padding: "11px", borderRadius: 10,
            border: "1.5px solid #e5e0d8", background: "white",
            color: "#7a6a5e", fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}