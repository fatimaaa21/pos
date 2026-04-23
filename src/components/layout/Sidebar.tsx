"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import type { Perfil } from "@/types";
import styles from "./Sidebar.module.css";
import { LayoutDashboard, Package, Grid, BarChart2, Users, ShoppingCart, ClipboardList, LogOut } from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navAdmin = [
    { icon: LayoutDashboard, label: "Dashboard",  href: "/admin/dashboard" },
    { icon: Package, label: "Productos",  href: "/admin/productos" },
    { icon: BarChart2, label: "Reportes",   href: "/admin/reportes" },
    { icon: Users, label: "Usuarios",   href: "/admin/usuarios" },
];

const navEmpleado = [
  { icon: "📦", label: "Inventario",  href: "/empleado/inventario" },
  { icon: "🛒", label: "Ventas",      href: "/empleado/ventas" },
  { icon: "📋", label: "Mis ventas",  href: "/empleado/mis-ventas" },
];

interface SidebarProps {
  perfil: Perfil;
  nombreNegocio?: string;
}

export function Sidebar({ perfil, nombreNegocio = "Panadería" }: SidebarProps) {
  const pathname = usePathname();
  const nav = perfil.rol === "admin" ? navAdmin : navEmpleado;
  const iniciales = perfil.nombre
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🥐</div>
        <div>
          <div className={styles.logoText}>{nombreNegocio}</div>
          <div className={styles.logoSub}>Sistema de gestión</div>
        </div>
      </div>

      {/* Navegación */}
      <nav className={styles.nav}>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${
              pathname === item.href ? styles.navItemActive : ""
            }`}
          >
            <span className={styles.navIcon}><item.icon size={14} className={styles.navIcon} /></span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

        <div className="actions" >
        {/* Usuario */}
        <div className={styles.user}>
            <div className={styles.avatar}>{iniciales}</div>
            <div>
                <div className={styles.userName}>{perfil.nombre}</div>
                <div className={styles.userRol}>{perfil.rol}</div>
            </div>
        </div>
        {/* Logout */}
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