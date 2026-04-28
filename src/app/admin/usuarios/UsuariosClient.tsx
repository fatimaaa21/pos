"use client";

import { useState } from "react";
import type { Perfil } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Buscador } from "@/components/ui/Buscador";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalCrearUsuario } from "./ModalCrearUsuario";
import { ModalVerUsuario } from "./ModalVerUsuario";
import { ModalEditarUsuario } from "./ModalEditarUsuario";
import { toggleEstadoUsuario, eliminarUsuario } from "@/lib/actions/usuarios";
import styles from "./usuarios.module.css";
import { Eye, Pencil } from "lucide-react";

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
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  const filtrados = usuarios.filter((u) => {
    const coincideBusqueda =
      u.tNameUser.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.tEmailUser.toLowerCase().includes(busqueda.toLowerCase());
    const coincideRol = filtroRol === "todos" || u.tRolUser === filtroRol;
    return coincideBusqueda && coincideRol;
  });

  const columnas: ColumnaTabla<Perfil>[] = [
    {
      key: "tNameUser",
      label: "Nombre",
      render: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.avatar}>{p.tNameUser[0].toUpperCase()}</div>
          <span>{p.tNameUser}</span>
        </div>
      ),
    },
    {
      key: "tEmailUser",
      label: "Email",
    },
    {
      key: "tRolUser",
      label: "Rol",
      render: (p) => (
        // variante "admin" o "empleado" según el rol
        <Badge variante={p.tRolUser} />
      ),
    },
    {
      key: "bStateUser",
      label: "Estado",
      render: (p) => (
        // atajo booleano: true → "Activo", false → "Inactivo"
        <Badge activo={p.bStateUser} />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (p) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <ActionBtn title="Ver detalles" onClick={() => setUsuarioVer(p)}><Eye /></ActionBtn>
          <ActionBtn title="Editar" onClick={() => setUsuarioEditar(p)}><Pencil /></ActionBtn>
          <ActionBtn
            title={p.bStateUser ? "Desactivar" : "Activar"}
            onClick={() => handleToggleEstado(p)}
            loading={toggleando === p.eCodUser}
          >
            {p.bStateUser ? "⏸" : "▶️"}
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(p)}
            loading={eliminando === p.eCodUser}
            danger
          >
            🗑
          </ActionBtn>
        </div>
      ),
    },
  ];

  async function handleToggleEstado(usuario: Perfil) {
    setToggleando(usuario.eCodUser);
    const result = await toggleEstadoUsuario(usuario.eCodUser, !usuario.bStateUser);
    if (!result?.error) {
      setUsuarios((prev) =>
        prev.map((u) =>
          u.eCodUser === usuario.eCodUser ? { ...u, bStateUser: !u.bStateUser } : u
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

      {/* Buscador + Header */}
      <div className="header">
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar usuario..."
        />
      </div>

      <PageHeader
        titulo="Usuarios"
        descripcion="Gestiona el acceso de tu equipo"
        boton={{ label: "Nuevo usuario", onClick: () => setModalCrear(true) }}
      />

      {/* Stats */}
      <div className={styles.stats}>
        {[
          { label: "Total usuarios",   value: usuarios.length, color: "#628321" },
          { label: "Activos",          value: totalActivos,    color: "#10b981" },
          { label: "Administradores",  value: totalAdmins,     color: "#a86530" },
        ].map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: "#7a6a5e", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros de rol */}
      <div className={styles.filtros}>
        {(["todos", "admin", "empleado"] as const).map((rol) => (
          <button
            key={rol}
            onClick={() => setFiltroRol(rol)}
            className={`${styles.filtroBtn} ${filtroRol === rol ? styles.filtroBtnActivo : ""}`}
          >
            {rol}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={(u) => u.eCodUser}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay usuarios registrados"
      />

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

// ── Botón de acción en tabla ─────────────────────────────────────────────────
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
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""} ${loading ? styles.actionBtnLoading : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}