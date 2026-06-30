import { createClient }           from "@/lib/supabase/server";
import { redirect }               from "next/navigation";
import { MenuClient }             from "@/app/empleado/menu/MenuClient";
import { MesasClient }            from "@/app/empleado/mesas/MesasClient";
import {
  obtenerDatosMenuPOS,
  obtenerDatosMesasPOS,
  obtenerEstadoTurno,
}                                  from "@/lib/data/menu-pos";
import { resolverSucursalVenta }  from "@/lib/utils/sucursal";
import { verificarModuloMesas, obtenerMesasConEstado } from "@/lib/actions/mesas";
import { AbrirTurnoGate }         from "@/components/pos/AbrirTurnoGate";
import type { MesaConEstado }     from "@/types";
import { Store } from "lucide-react";

export default async function AdminMenuPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil || perfil.tRolUser !== "admin") redirect("/admin/dashboard");

  // Resuelve la sucursal donde se va a vender. Si el admin tiene "Todas las
  // sucursales" seleccionado y el negocio tiene más de una activa, no hay
  // forma de saber dónde — se le pide elegir una específica primero.
  const ctx = await resolverSucursalVenta();

  if ("error" in ctx) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "70vh", textAlign: "center",
        gap: 12, padding: 24,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "var(--radius-md)",
          background: "var(--color-primary-50)", color: "var(--color-primary-dark)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Store size={22} />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--dark)", margin: 0 }}>
          Elige una sucursal para vender
        </h2>
        <p style={{ fontSize: 13, color: "var(--gray)", maxWidth: 320, margin: 0 }}>
          {ctx.error}. Usa el selector de sucursal en la parte superior del menú
          para elegir una específica.
        </p>
      </div>
    );
  }

  // ── Si el negocio tiene el módulo de mesas activo, el "Menú" del admin se
  //    convierte en el flujo de mesas: seleccionar mesa → tomar/editar pedido.
  //    Reutiliza exactamente el mismo MesasClient que usa el empleado, sin
  //    cambios — el pedido se puede seguir editando (agregar productos) hasta
  //    que se cobra, igual que en /empleado/mesas.
  const moduloMesas = await verificarModuloMesas(ctx.fkeCodCompany);

  if (moduloMesas) {
    const [mesas, datos, turno] = await Promise.all([
      obtenerMesasConEstado(),
      obtenerDatosMesasPOS(ctx.fkeCodCompany),
      obtenerEstadoTurno(ctx.uid),
    ]);

    return (
      <AbrirTurnoGate
        tieneTurno={turno.tieneTurno}
        corte={turno.corte}
        ventasDelTurno={turno.ventasDelTurno}
      >
        <MesasClient
          mesasIniciales={mesas as MesaConEstado[]}
          categorias={datos.categorias}
          productos={datos.productos}
          metodosPago={datos.metodosPago}
          tieneTurno={turno.tieneTurno}
          aplicarIva={datos.aplicarIva}
          tipo_negocio={datos.tipo_negocio}
          conceptos={datos.conceptos}
        />
      </AbrirTurnoGate>
    );
  }

  // ── Sin módulo de mesas: venta directa de mostrador (comportamiento actual) ──
  const [datos, turno] = await Promise.all([
    obtenerDatosMenuPOS(ctx.fkeCodCompany),
    obtenerEstadoTurno(ctx.uid),
  ]);

  return (
    <MenuClient
      categorias={datos.categorias}
      productos={datos.productos}
      metodosPago={datos.metodosPago}
      tieneTurno={turno.tieneTurno}
      corte={turno.corte}
      ventasDelTurno={turno.ventasDelTurno}
      aplicarIva={datos.aplicarIva}
    />
  );
}