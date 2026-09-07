import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CortesAdminClient } from "./CortesAdminClient";
import type { CorteCaja }    from "@/types";
import { getSucursalContext } from "@/lib/utils/sucursal";


export default async function CortesAdminPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;
  if (!fkeCodCompany) return null;

  const ctx            = await getSucursalContext();
  const fkeCodSucursal = ctx.fkeCodSucursal;

  // Todos los cortes del negocio ordenados por más reciente
  let cortesQuery = adminClient
    .from("cortes_caja")
    .select("*")
    .eq("fkeCodCompany", fkeCodCompany)
    .order("fhCreateCorte", { ascending: false });

  if (fkeCodSucursal) cortesQuery = cortesQuery.eq("fkeCodSucursal", fkeCodSucursal);

const { data: cortes, error } = await cortesQuery;

  if (error) console.error("Error cargando cortes:", error.message);

  // Perfiles de los empleados que tienen cortes
  const empleadoIds = [...new Set((cortes ?? []).map(c => c.fkeCodUser))];
  let perfiles: any[] = [];

  if (empleadoIds.length > 0) {
    const { data: perfs } = await adminClient
      .from("perfiles")
      .select("eCodUser, tNameUser")
      .in("eCodUser", empleadoIds);

    perfiles = perfs ?? [];
  }

  const perfilesMap = new Map(perfiles.map(p => [p.eCodUser, p]));

  const cortesConEmpleado = (cortes ?? []).map(c => ({
    ...c,
    empleado: perfilesMap.get(c.fkeCodUser) ?? null,
  }));

  // Métodos de pago activos del negocio — el desglose del corte solo debe
  // mostrar Efectivo/Tarjeta/Transferencia si el negocio realmente tiene
  // activado algún método de esa categoría (mismo agrupamiento por nombre
  // que ya usa cerrarTurno en src/lib/actions/cortes.ts).
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const idsMetodosActivos: string[] = negocio?.metodosPago ?? [];

  let nombresMetodosActivos: string[] = [];
  if (idsMetodosActivos.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("tNamePay")
      .in("eCodPay", idsMetodosActivos);

    nombresMetodosActivos = (metodos ?? []).map((m) => m.tNamePay.toLowerCase());
  }

  const desgloseMetodos = {
    efectivo:      nombresMetodosActivos.some((n) => n.includes("efectivo")),
    tarjeta:       nombresMetodosActivos.some((n) => n.includes("tarjeta")),
    transferencia: nombresMetodosActivos.some((n) => !n.includes("efectivo") && !n.includes("tarjeta")),
  };

  return <CortesAdminClient cortes={cortesConEmpleado} desgloseMetodos={desgloseMetodos} />;
}