"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/actions/auth";
import type { Perfil } from "@/types";
import styles from "./Sidebar.module.css";
import {
  LayoutDashboard,
  Package,
  BarChart2,
  BookOpenText,
  Users,
  LogOut,
  ClipboardList,
  ClipboardPenLine,
  Building2,
  Settings,
  ChevronUp,
} from "lucide-react";

const navAdmin = [
  { icon: LayoutDashboard,  label: "Dashboard",  href: "/admin/dashboard" },
  { icon: BookOpenText,     label: "Catálogo",   href: "/admin/catalogo" },
  { icon: Package,          label: "Productos",  href: "/admin/productos" },
  { icon: ClipboardPenLine, label: "Inventario", href: "/admin/inventario" },
  { icon: BarChart2,        label: "Ventas",     href: "/admin/ventasAdmin" },
  { icon: Users,            label: "Usuarios",   href: "/admin/usuarios" },
];

const navEmpleado = [
  { icon: ClipboardList,    label: "Menú",       href: "/empleado/menu" },
  { icon: ClipboardPenLine, label: "Inventario", href: "/empleado/inventario" },
  { icon: Users,            label: "Mis ventas", href: "/empleado/ventasEmpleado" },
];

const navSistemas = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/sistemas/dashboard" },
  { icon: Building2,       label: "Negocios",  href: "/sistemas/negocios" },
  { icon: Building2,       label: "Métodos Pagos",  href: "/sistemas/metodosPago" },
];

interface NegocioInfo {
  tNameCompany: string;
  imgCompany:   string | null;
}

interface SidebarProps {
  perfil:   Perfil;
  negocio?: NegocioInfo | null;
}

export function Sidebar({ perfil, negocio }: SidebarProps) {
  const pathname = usePathname();
  const [popupAbierto, setPopupAbierto] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const nav =
    perfil.tRolUser === "admin"    ? navAdmin :
    perfil.tRolUser === "sistemas" ? navSistemas :
    navEmpleado;

  const esAdmin = perfil.tRolUser === "admin";

  const iniciales = perfil.tNameUser
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const inicialesNegocio = negocio?.tNameCompany
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "??";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupAbierto(false);
      }
    }
    if (popupAbierto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupAbierto]);

  return (
    <aside className={styles.sidebar}>

      {/* ── Logo del negocio ── */}
      <div className={styles.logo}>
        {negocio?.imgCompany ? (
          <img
            src={negocio.imgCompany}
            alt={negocio.tNameCompany}
            className={styles.logoImg}
          />
        ) : (
          <div className={styles.logoFallback}>
            {inicialesNegocio}
          </div>
        )}
        <div className={styles.logoTextos}>
          <div className={styles.logoText}>
            {negocio?.tNameCompany ?? "Mi negocio"}
          </div>
        </div>
      </div>

      {/* ── Navegación ── */}
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

      {/* ── Footer de usuario ── */}
      <div className={styles.actionsUser} ref={popupRef}>

        {esAdmin && popupAbierto && (
          <div className={styles.userPopup}>
            <div className={styles.userPopupHeader}>
              <div className={styles.avatar}>{iniciales}</div>
              <div>
                <p className={styles.userName}>{perfil.tNameUser}</p>
                <p className={styles.userRol}>{perfil.tRolUser}</p>
              </div>
            </div>

            <div className={styles.userPopupDivider} />

            <Link
              href="/admin/configuracion"
              className={styles.userPopupItem}
              onClick={() => setPopupAbierto(false)}
            >
              <Settings size={14} />
              <span>Configuración</span>
            </Link>

            <div className={styles.userPopupDivider} />

            <form action={logout}>
              <button
                type="submit"
                className={`${styles.userPopupItem} ${styles.userPopupItemDanger}`}
              >
                <LogOut size={14} />
                <span>Cerrar sesión</span>
              </button>
            </form>
          </div>
        )}

        {esAdmin ? (
          <button
            className={styles.userBtn}
            onClick={() => setPopupAbierto((v) => !v)}
            aria-label="Opciones de usuario"
          >
            <div className={styles.avatar}>{iniciales}</div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{perfil.tNameUser}</p>
              <p className={styles.userRol}>{perfil.tRolUser}</p>
            </div>
            <ChevronUp
              size={14}
              className={`${styles.userChevron} ${popupAbierto ? styles.userChevronOpen : ""}`}
            />
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </aside>
  );
}