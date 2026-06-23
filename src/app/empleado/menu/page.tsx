import { createClient }      from "@/lib/supabase/server";
import { MenuClient }        from "./MenuClient";
import { MesasClient }       from "@/app/empleado/mesas/MesasClient";
import { AbrirTurnoGate }    from "@/components/pos/AbrirTurnoGate";
import {
  obtenerDatosMenuPOS,
  obtenerDatosMesasPOS,
  obtenerEstadoTurno,
}                             from "@/lib/data/menu-pos";
import { verificarModuloMesas, obtenerMesasConEstado } from "@/lib/actions/mesas";
import type { MesaConEstado } from "@/types";

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;

  if (!fkeCodCompany) {
    return (
      <MenuClient
        categorias={[]}
        productos={[]}
        metodosPago={[]}
        tieneTurno={false}
        corte={null}
        ventasDelTurno={{
          eTotalEfectivo: 0, eTotalTarjeta: 0,
          eTotalTransferencia: 0, eTotalVentas: 0, eNumVentas: 0,
        }}
        aplicarIva
      />
    );
  }

  // ── Si el negocio tiene el módulo de mesas activo, "Menú" se convierte en
  //    el flujo de mesas: seleccionar mesa → tomar/editar pedido → cobrar.
  //    Mismo comportamiento que /admin/menu — sin esto, no tiene caso dejar
  //    al empleado vender directo sin pasar por una mesa cuando el negocio
  //    opera con servicio de mesas.
  const moduloMesas = await verificarModuloMesas(fkeCodCompany);

  if (moduloMesas) {
    const [mesas, datos, turno] = await Promise.all([
      obtenerMesasConEstado(),
      obtenerDatosMesasPOS(fkeCodCompany),
      obtenerEstadoTurno(user!.id),
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
        />
      </AbrirTurnoGate>
    );
  }

  // ── Sin módulo de mesas: venta directa de mostrador (comportamiento actual) ──
  const [datos, turno] = await Promise.all([
    obtenerDatosMenuPOS(fkeCodCompany),
    obtenerEstadoTurno(user!.id),
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