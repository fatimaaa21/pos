import { createClient }           from "@/lib/supabase/server";
import { redirect }               from "next/navigation";
import { MenuClient }             from "@/app/empleado/menu/MenuClient";
import { obtenerDatosMenuPOS, obtenerEstadoTurno } from "@/lib/data/menu-pos";
import { resolverSucursalVenta }  from "@/lib/utils/sucursal";
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

  // Resuelve la sucursal donde se registrará la venta.
  // Si el admin tiene "Todas las sucursales" seleccionado y el negocio
  // tiene más de una activa, no hay forma de saber dónde vender — se
  // le pide elegir una específica desde el selector del sidebar.
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