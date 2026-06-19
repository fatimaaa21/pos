"use client";

import { useState } from "react";
import type { Perfil, Sucursal } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalCrearUsuario } from "./ModalCrearUsuario";
import { ModalVerUsuario } from "./ModalVerUsuario";
import { ModalEditarUsuario } from "./ModalEditarUsuario";
import { toggleEstadoUsuario, eliminarUsuario } from "@/lib/actions/usuarios";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import styles from "./usuarios.module.css";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { formatFechaHora } from "@/lib/utils/fecha";
import { toast } from "react-hot-toast";

interface Props {
  usuarios: Perfil[];
  sucursales: Pick<Sucursal, "eCodSucursal" | "tNombre">[];
}

export function UsuariosClient({ usuarios: inicial, sucursales }: Props) {
  const [usuarios, setUsuarios] = useState<Perfil[]>(inicial);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles: [],
    estados: [],
  });
  const [modalCrear, setModalCrear] = useState(false);
  const [usuarioVer, setUsuarioVer] = useState<Perfil | null>(null);
  const [usuarioEditar, setUsuarioEditar] = useState<Perfil | null>(null);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Perfil | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toggleando, setToggleando] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  const filtrados = usuarios.filter((u) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto ||
      u.tNameUser.toLowerCase().includes(texto) ||
      u.tEmailUser.toLowerCase().includes(texto);
 
    const coincideRol =
      filtros.roles.length === 0 || filtros.roles.includes(u.tRolUser as "admin" | "empleado");
 
    const estadoValor = u.bStateUser ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);
 
    return coincideTexto && coincideRol && coincideEstado;
  });

  async function handleToggleEstado(usuario: Perfil) {
  setToggleando(usuario.eCodUser);
  const result = await toggleEstadoUsuario(usuario.eCodUser, !usuario.bStateUser);
  if (!result?.error) {
    setUsuarios((prev) =>
      prev.map((u) =>
        u.eCodUser === usuario.eCodUser ? { ...u, bStateUser: !u.bStateUser } : u
      )
    );
    const nuevoEstado = !usuario.bStateUser;
    toast.success(`${usuario.tNameUser} ${nuevoEstado ? "activado" : "desactivado"}`);
  } else {
    toast.error(`No se pudo cambiar el estado: ${result.error}`);
  }
  setToggleando(null);
}

  function handleEliminar(usuario: Perfil) {
  setUsuarioAEliminar(usuario);
}
 
async function confirmarEliminar() {
  if (!usuarioAEliminar) return;
  setEliminando(usuarioAEliminar.eCodUser);
  const result = await eliminarUsuario(usuarioAEliminar.eCodUser);
  setEliminando(null);
  if (!result?.error) {
    setUsuarios((prev) =>
      prev.filter((u) => u.eCodUser !== usuarioAEliminar.eCodUser)
    );
    toast.success(`${usuarioAEliminar.tNameUser} eliminado`);
    setUsuarioAEliminar(null);
  } else {
    toast.error(result.error);
    setUsuarioAEliminar(null);
  }
}

  function handleUsuarioCreado(nuevo: Perfil) {
  setUsuarios((prev) => [nuevo, ...prev]);
  setModalCrear(false);
  toast.success(`${nuevo.tNameUser} creado — código enviado por correo`);
}

  function handleUsuarioEditado(actualizado: Perfil) {
  setUsuarios((prev) =>
    prev.map((u) => (u.eCodUser === actualizado.eCodUser ? actualizado : u))
  );
  setUsuarioEditar(null);
  toast.success(`${actualizado.tNameUser} actualizado`);
}

  const columnas: ColumnaTabla<Perfil>[] = [
    {
      key: "tNameUser",
      label: "Nombre",
      render: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className={styles.avatar}
            style={
              p.tRolUser === "admin"
                ? { background: "var(--color-accent-bg)", color: "var(--color-accent)" }
                : { background: "var(--color-primary-50)", color: "var(--color-primary-dark)" }
            }
          >
            {p.tNameUser[0].toUpperCase()}
          </div>
          <span>{p.tNameUser}</span>
        </div>
      ),
    },
    {
        key: "tEmailUser",
        label: "Email",
    },
    {
        key: "fhCreateUser",
        label: "Fecha de creación",
        render: (u) => <span>{formatFechaHora(u.fhCreateUser)}</span>
    },
    {
      key: "tRolUser",
      label: "Rol",
      render: (p) => <Badge variante={p.tRolUser} />,
    },
    {
      key: "bStateUser",
      label: "Estado",
      render: (p) => (
        <Badge
          activo={p.bStateUser}
          onToggle={() => handleToggleEstado(p)}
          toggling={toggleando === p.eCodUser}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (p) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setUsuarioVer(p)}>
            <Eye size={18} />
          </ActionBtn>
          <ActionBtn title="Editar" onClick={() => setUsuarioEditar(p)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(p)}
            loading={eliminando === p.eCodUser}
            danger
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  const totalActivos = usuarios.filter((u) => u.bStateUser).length;
  const totalAdmins = usuarios.filter((u) => u.tRolUser === "admin").length;

  return (
    <div className="container">
     <PageHeader
        titulo="Usuarios"
        descripcion="Gestiona el acceso de tu equipo"
        boton={{ label: "Nuevo usuario", onClick: () => setModalCrear(true) }}
      />

      {/* Stats */}
      <StatCards stats={[
        { label: "Total usuarios",  value: usuarios.length, variante: "primary" },
        { label: "Activos",         value: totalActivos,    variante: "success" },
        { label: "Administradores", value: totalAdmins,     variante: "accent"  },
      ]} />

      {/* Filtros */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
      />

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
          sucursales={sucursales}
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
          sucursales={sucursales}
        />
      )}
      {usuarioAEliminar && (
        <ToastConfirmarEliminar
          tipo="empleado"
          nombre={usuarioAEliminar.tNameUser}
          advertencia={
            usuarioAEliminar.tRolUser === "admin"
              ? "Este usuario tiene rol de administrador. Al eliminarlo perderá acceso inmediatamente."
              : undefined
          }
          onConfirmar={confirmarEliminar}
          onCancelar={() => setUsuarioAEliminar(null)}
          cargando={eliminando === usuarioAEliminar.eCodUser}
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
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""} ${loading ? styles.actionBtnLoading : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}