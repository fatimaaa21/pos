"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import type { Perfil } from "@/types";
import styles from "./Sidebar.module.css";
import { LayoutDashboard, Package, BarChart2, BookOpenText, Users, LogOut, ClipboardList, ClipboardPenLine, Building2 } from "lucide-react";

const navAdmin = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: BookOpenText,    label: "Catálogo",   href: "/admin/catalogo" },
  { icon: Package,         label: "Productos",  href: "/admin/productos" },
  { icon: ClipboardPenLine,     label: "Inventario",  href: "/admin/inventario" },
  { icon: BarChart2,       label: "Reportes",   href: "/admin/reportes" },
  { icon: Users,           label: "Usuarios",   href: "/admin/usuarios" },
];

const navEmpleado = [
  { icon: ClipboardList,   label: "Menú", href: "/empleado/menu" },
  { icon: ClipboardPenLine, label: "Inventario",     href: "/empleado/inventario" },
  { icon: Users,     label: "Mis ventas", href: "/empleado/mis-ventas" },
];

const navSistemas = [
  { icon: LayoutDashboard,   label: "Dashboard",  href: "/sistemas/dashboard" },
  { icon: Building2,         label: "Negocios",   href: "/sistemas/negocios" },
];

interface SidebarProps {
  perfil: Perfil;
  nombreNegocio?: string;
}

export function Sidebar({ perfil, nombreNegocio = "Panadería" }: SidebarProps) {
  const pathname = usePathname();
  const nav =
    perfil.tRolUser === "admin"    ? navAdmin :
    perfil.tRolUser === "sistemas" ? navSistemas :
    navEmpleado;

  const esSistemas = perfil.tRolUser === "sistemas";

  const iniciales = perfil.tNameUser
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🥐</div>
        <div>
          <div className={styles.logoText}>{nombreNegocio}</div>
          <div className={styles.logoSub}>Sistema de gestión</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${
              pathname === item.href ? styles.navItemActive : ""
            }`}
          >
            <item.icon size={16} className={styles.navIcon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="actions">
        <div className={styles.user}>
          <div className={styles.avatar}>{iniciales}</div>
          <div>
            <div className={styles.userName}>{perfil.tNameUser}</div>
            <div className={styles.userRol}>{perfil.tRolUser}</div>
          </div>
        </div>
        <form action={logout}>
          <button className={styles.navItem}>
            <LogOut size={14} color="var(--color-primary)" />
            Cerrar Sesión
          </button>
        </form>
      </div>
    </aside>
  );
}