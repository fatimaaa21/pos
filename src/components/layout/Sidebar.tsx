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
  LayoutDashboard, Package, ReceiptText, BookOpenText,
  Users, LogOut, ClipboardList, ClipboardPenLine,
  Building2, Settings, ChevronUp, CircleDollarSign,
  Calculator, Menu, X, LayoutGrid,
} from "lucide-react";

function buildNavAdmin(modulosActivos: string[]) {
  const nav = [
    { icon: LayoutDashboard,  label: "Dashboard",      href: "/admin/dashboard"   },
    { icon: BookOpenText,     label: "Catálogo",        href: "/admin/catalogo"    },
    { icon: Package,          label: "Productos",       href: "/admin/productos"   },
    { icon: ClipboardPenLine, label: "Inventario",      href: "/admin/inventario"  },
    { icon: ReceiptText,      label: "Ventas",          href: "/admin/ventasAdmin" },
    { icon: Calculator,       label: "Cortes de caja",  href: "/admin/cortes"      },
    { icon: Users,            label: "Usuarios",        href: "/admin/usuarios"    },
  ];

  if (modulosActivos.includes("mesas")) {
    nav.push({ icon: LayoutGrid, label: "Mesas", href: "/admin/mesas" });
  }

  return nav;
}

function buildNavEmpleado(modulosActivos: string[]) {
  const nav = [
    { icon: ClipboardList,    label: "Menú",       href: "/empleado/menu"           },
    { icon: ClipboardPenLine, label: "Inventario", href: "/empleado/inventario"     },
    { icon: ReceiptText,      label: "Mis ventas", href: "/empleado/ventasEmpleado" },
  ];

  if (modulosActivos.includes("mesas")) {
    nav.splice(1, 0, { icon: LayoutGrid, label: "Mesas", href: "/empleado/mesas" });
  }

  return nav;
}

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
  modulosActivos?: string[];
}

export function Sidebar({ perfil, negocio, modulosActivos = [] }: SidebarProps) {
  const pathname = usePathname();
  const [popupAbierto,  setPopupAbierto]  = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const abrirConfiguracion = useConfiguracionStore((s) => s.abrir);

  const nav =
    perfil.tRolUser === "admin"    ? buildNavAdmin(modulosActivos)    :
    perfil.tRolUser === "sistemas" ? navSistemas                      :
    buildNavEmpleado(modulosActivos);

  const esAdmin    = perfil.tRolUser === "admin";
  const esSistemas = perfil.tRolUser === "sistemas";

  const iniciales = perfil.tNameUser
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const inicialesNegocio = negocio?.tNameCompany
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "??";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupAbierto(false);
      }
    }
    if (popupAbierto) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupAbierto]);

  useEffect(() => {
    document.body.style.overflow = drawerAbierto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerAbierto]);

  useEffect(() => { setDrawerAbierto(false); }, [pathname]);

  function cerrarDrawer() {
    setDrawerAbierto(false);
    setPopupAbierto(false);
  }

  function renderLogo() {
    if (esSistemas) {
      return (
        <div className={styles.logoRow}>
          <div className={styles.logo}>
            <img src="/kivi-logo.svg" alt="Kivi" className={styles.logoImg} />
            <div className={styles.logoTextos}>
              <div className={styles.logoText}>Kivi</div>
            </div>
          </div>
          {/* Botón cerrar — solo visible en mobile */}
          <button
            className={styles.btnCerrarDrawer}
            onClick={cerrarDrawer}
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>
        </div>
      );
    }

    return (
      <div className={styles.logoRow}>
        <div className={styles.logo}>
          {negocio?.imgCompany ? (
            <img src={negocio.imgCompany} alt={negocio.tNameCompany} className={styles.logoImg} />
          ) : (
            <div className={styles.logoFallback}>{inicialesNegocio}</div>
          )}
          <div className={styles.logoTextos}>
            <div className={styles.logoText}>{negocio?.tNameCompany ?? "Kivi"}</div>
          </div>
        </div>
        {/* Botón cerrar — solo visible en mobile */}
        <button
          className={styles.btnCerrarDrawer}
          onClick={cerrarDrawer}
          aria-label="Cerrar menú"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Hamburger externo — solo cuando el drawer está CERRADO */}
      {!drawerAbierto && (
        <button
          className={styles.hamburger}
          onClick={() => setDrawerAbierto(true)}
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Overlay */}
      {drawerAbierto && (
        <div className={styles.overlay} onClick={cerrarDrawer} aria-hidden="true" />
      )}

      <aside className={`${styles.sidebar} ${drawerAbierto ? styles.sidebarOpen : ""}`}>

        {renderLogo()}

        <nav className={styles.nav}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ""}`}
              onClick={cerrarDrawer}
            >
              <item.icon size={16} className={styles.navIcon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

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
              <button
                className={styles.userPopupItem}
                onClick={() => { abrirConfiguracion(); setPopupAbierto(false); cerrarDrawer(); }}
              >
                <Settings size={14} />
                <span>Configuración</span>
              </button>
              <div className={styles.userPopupDivider} />
              <form action={logout}>
                <button type="submit" className={`${styles.userPopupItem} ${styles.userPopupItemDanger}`}>
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
              title={perfil.tNameUser}
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
              <div className={styles.user} title={perfil.tNameUser}>
                <div className={styles.avatar}>{iniciales}</div>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>{perfil.tNameUser}</div>
                  <div className={styles.userRol}>{perfil.tRolUser}</div>
                </div>
              </div>
              <form action={logout}>
                <button className={styles.navItem} title="Cerrar sesión" onClick={cerrarDrawer}>
                  <LogOut size={14} className={styles.navIcon} />
                  <span>Cerrar Sesión</span>
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}