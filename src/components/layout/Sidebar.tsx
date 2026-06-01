// src/components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/actions/auth";
import { useConfiguracionStore } from "@/lib/stores/configuracion";
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
  CircleDollarSign,
  Calculator,
} from "lucide-react";

const navAdmin = [
  { icon: LayoutDashboard,  label: "Dashboard",      href: "/admin/dashboard"   },
  { icon: BookOpenText,     label: "Catálogo",        href: "/admin/catalogo"    },
  { icon: Package,          label: "Productos",       href: "/admin/productos"   },
  { icon: ClipboardPenLine, label: "Inventario",      href: "/admin/inventario"  },
  { icon: BarChart2,        label: "Ventas",          href: "/admin/ventasAdmin" },
  { icon: Calculator,       label: "Cortes de caja",  href: "/admin/cortes"      },
  { icon: Users,            label: "Usuarios",        href: "/admin/usuarios"    },
];

const navEmpleado = [
  { icon: ClipboardList,    label: "Menú",       href: "/empleado/menu"           },
  { icon: ClipboardPenLine, label: "Inventario", href: "/empleado/inventario"     },
  { icon: Users,            label: "Mis ventas", href: "/empleado/ventasEmpleado" },
];

const navSistemas = [
  { icon: LayoutDashboard,  label: "Dashboard", href: "/sistemas/dashboard"   },
  { icon: Building2,        label: "Negocios",  href: "/sistemas/negocios"    },
  { icon: CircleDollarSign, label: "Pagos",     href: "/sistemas/metodosPago" },
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

  // Store de configuración — abre el modal sin navegar a una ruta
  const abrirConfiguracion = useConfiguracionStore((s) => s.abrir);

  const nav =
    perfil.tRolUser === "admin"    ? navAdmin    :
    perfil.tRolUser === "sistemas" ? navSistemas :
    navEmpleado;

  const esAdmin    = perfil.tRolUser === "admin";
  const esSistemas = perfil.tRolUser === "sistemas";

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

  // ── Logo según rol ─────────────────────────────────────────────────────────
  function renderLogo() {
    if (esSistemas) {
      return (
        <div className={styles.logo}>
          <img src="/kivi-logo.svg" alt="Kivi" className={styles.logoImg} />
          <div className={styles.logoTextos}>
            <div className={styles.logoText}>Kivi</div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.logo}>
        {negocio?.imgCompany ? (
          <img
            src={negocio.imgCompany}
            alt={negocio.tNameCompany}
            className={styles.logoImg}
          />
        ) : (
          <div className={styles.logoFallback}>{inicialesNegocio}</div>
        )}
        <div className={styles.logoTextos}>
          <div className={styles.logoText}>
            {negocio?.tNameCompany ?? "Kivi"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className={styles.sidebar}>

      {/* ── Logo ── */}
      {renderLogo()}

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

        {/* Popup del admin */}
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

            {/*
              Antes: <Link href="/admin/configuracion"> → navegaba a una ruta
              Ahora: <button> que abre el modal sobre la página actual
            */}
            <button
              className={styles.userPopupItem}
              onClick={() => {
                abrirConfiguracion();
                setPopupAbierto(false);
              }}
            >
              <Settings size={14} />
              <span>Configuración</span>
            </button>

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

        {/* Botón/usuario en footer */}
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