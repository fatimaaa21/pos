"use client";

import { useState } from "react";
import type { Perfil } from "@/types";
import { Buscador } from "@/components/ui/Buscador";
import { ModalCrearUsuario } from "./ModalCrearUsuario";
import { ModalVerUsuario } from "./ModalVerUsuario";
import { ModalEditarUsuario } from "./ModalEditarUsuario";
import {
  toggleEstadoUsuario,
  eliminarUsuario,
} from "@/lib/actions/usuarios";

interface Props {
  usuarios: Perfil[];
}

export function UsuariosClient({ usuarios: inicial }: Props) {
  const [usuarios, setUsuarios] = useState<Perfil[]>(inicial);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<"todos" | "admin" | "empleado">("todos");
  const [modalCrear, setModalCrear] = useState(false);
  const [usuarioVer, setUsuarioVer] = useState<Perfil | null>(null);
  const [usuarioEditar, setUsuarioEditar] = useState<Perfil | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toggleando, setToggleando] = useState<string | null>(null);

  const filtrados = usuarios.filter((u) => {
    const coincideBusqueda =
      u.tNameUser.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.tEmailUser.toLowerCase().includes(busqueda.toLowerCase());
    const coincideRol = filtroRol === "todos" || u.tRolUser === filtroRol;
    return coincideBusqueda && coincideRol;
  });

  async function handleToggleEstado(usuario: Perfil) {
    setToggleando(usuario.eCodUser);
    const result = await toggleEstadoUsuario(usuario.eCodUser, !usuario.bStateUser);
    if (!result?.error) {
      setUsuarios((prev) =>
        prev.map((u) =>
          u.eCodUser === usuario.eCodUser
            ? { ...u, bStateUser: !u.bStateUser }
            : u
        )
      );
    }
    setToggleando(null);
  }

  async function handleEliminar(usuario: Perfil) {
    if (!confirm(`¿Eliminar a ${usuario.tNameUser}? Esta acción no se puede deshacer.`)) return;
    setEliminando(usuario.eCodUser);
    const result = await eliminarUsuario(usuario.eCodUser);
    if (!result?.error) {
      setUsuarios((prev) => prev.filter((u) => u.eCodUser !== usuario.eCodUser));
    }
    setEliminando(null);
  }

  function handleUsuarioCreado(nuevo: Perfil) {
    setUsuarios((prev) => [nuevo, ...prev]);
    setModalCrear(false);
  }

  function handleUsuarioEditado(actualizado: Perfil) {
    setUsuarios((prev) =>
      prev.map((u) => (u.eCodUser === actualizado.eCodUser ? actualizado : u))
    );
    setUsuarioEditar(null);
  }

  const totalActivos = usuarios.filter((u) => u.bStateUser).length;
  const totalAdmins = usuarios.filter((u) => u.tRolUser === "admin").length;

  return (
    <div className="container">

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 700, color: "#1a1a1a", margin: 0,
          }}>
            Usuarios
          </h1>
          <p style={{ color: "#7a6a5e", fontSize: 14, marginTop: 4 }}>
            Gestiona el acceso de tu equipo
          </p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          style={{
            background: "linear-gradient(135deg, #628321, #4a6318)",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(98,131,33,0.3)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Nuevo usuario
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total usuarios", value: usuarios.length, color: "#628321" },
          { label: "Activos", value: totalActivos, color: "#10b981" },
          { label: "Administradores", value: totalAdmins, color: "#a86530" },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: "white",
            borderRadius: 14,
            padding: "16px 20px",
            border: "1px solid #f0ebe4",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: "#7a6a5e", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1.5px solid #e5e0d8",
            fontSize: 14,
            background: "white",
            color: "#1a1a1a",
            outline: "none",
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        {(["todos", "admin", "empleado"] as const).map((rol) => (
          <button
            key={rol}
            onClick={() => setFiltroRol(rol)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: `1.5px solid ${filtroRol === rol ? "#628321" : "#e5e0d8"}`,
              background: filtroRol === rol ? "#f0f5e8" : "white",
              color: filtroRol === rol ? "#628321" : "#7a6a5e",
              fontSize: 13,
              fontWeight: filtroRol === rol ? 600 : 400,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textTransform: "capitalize",
            }}
          >
            {rol}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid #f0ebe4",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        {/* Header tabla */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1fr 1.5fr 1.2fr",
          padding: "12px 20px",
          background: "#f8f7f4",
          borderBottom: "1px solid #f0ebe4",
          fontSize: 12,
          fontWeight: 600,
          color: "#9a8a7e",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          <span>Nombre</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Estado</span>
          <span>Creado</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>

        {/* Filas */}
        {filtrados.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#9a8a7e", fontSize: 14 }}>
            No se encontraron usuarios
          </div>
        ) : (
          filtrados.map((usuario, i) => (
            <div
              key={usuario.eCodUser}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1fr 1fr 1.5fr 1.2fr",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: i < filtrados.length - 1 ? "1px solid #f5f0ea" : "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf9f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              {/* Nombre */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: usuario.tRolUser === "admin"
                    ? "linear-gradient(135deg, #d4a574, #a86530)"
                    : "linear-gradient(135deg, #a8c97a, #628321)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {usuario.tNameUser.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>
                  {usuario.tNameUser}
                </span>
              </div>

              {/* Email */}
              <span style={{ fontSize: 13, color: "#7a6a5e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {usuario.tEmailUser}
              </span>

              {/* Rol */}
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: usuario.tRolUser === "admin" ? "#fef3e8" : "#f0f5e8",
                color: usuario.tRolUser === "admin" ? "#a86530" : "#628321",
                width: "fit-content",
              }}>
                {usuario.tRolUser}
              </span>

              {/* Estado */}
              <div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: usuario.bStateUser ? "#f0fdf4" : "#fef2f2",
                  color: usuario.bStateUser ? "#16a34a" : "#dc2626",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: usuario.bStateUser ? "#16a34a" : "#dc2626",
                  }} />
                  {usuario.bStateUser ? "Activo" : "Inactivo"}
                </span>
              </div>

              {/* Fecha */}
              <span style={{ fontSize: 13, color: "#9a8a7e" }}>
                {new Date(usuario.fhCreateUser).toLocaleDateString("es-MX", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </span>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <ActionBtn title="Ver detalle" onClick={() => setUsuarioVer(usuario)}>👁</ActionBtn>
                <ActionBtn title="Editar" onClick={() => setUsuarioEditar(usuario)}>✏️</ActionBtn>
                <ActionBtn
                  title={usuario.bStateUser ? "Desactivar" : "Activar"}
                  onClick={() => handleToggleEstado(usuario)}
                  loading={toggleando === usuario.eCodUser}
                >
                  {usuario.bStateUser ? "⏸" : "▶️"}
                </ActionBtn>
                <ActionBtn
                  title="Eliminar"
                  onClick={() => handleEliminar(usuario)}
                  loading={eliminando === usuario.eCodUser}
                  danger
                >
                  🗑
                </ActionBtn>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modales */}
      {modalCrear && (
        <ModalCrearUsuario
          onClose={() => setModalCrear(false)}
          onCreado={handleUsuarioCreado}
        />
      )}
      {usuarioVer && (
        <ModalVerUsuario
          usuario={usuarioVer}
          onClose={() => setUsuarioVer(null)}
        />
      )}
      {usuarioEditar && (
        <ModalEditarUsuario
          usuario={usuarioEditar}
          onClose={() => setUsuarioEditar(null)}
          onEditado={handleUsuarioEditado}
        />
      )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: `1px solid ${danger ? "#fecaca" : "#e5e0d8"}`,
        background: danger ? "#fef2f2" : "#fafaf9",
        cursor: loading ? "wait" : "pointer",
        fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
        opacity: loading ? 0.5 : 1,
        transition: "all 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger ? "#fee2e2" : "#f5f0ea";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger ? "#fef2f2" : "#fafaf9";
      }}
    >
      {loading ? "⏳" : children}
    </button>
  );
}