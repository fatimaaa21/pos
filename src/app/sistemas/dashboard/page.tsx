import { createAdminClient } from "@/lib/supabase/admin";
import {
  SistemasDashboardClient,
  type NegocioSistemas,
  type MetodoPagoSistemas,
  type TendenciaMes,
} from "./SistemasDashboardClient";

export default async function SistemasDashboardPage() {
  const adminClient = createAdminClient();

  const pad = (n: number) => String(n).padStart(2, "0");
  const ahora = new Date();

  // ── Rangos de fecha para comparación de crecimiento ───────────────────────

  // Inicio del mes actual (UTC)
  const inicioEsteMes = new Date(
    ahora.getFullYear(), ahora.getMonth(), 1
  ).toISOString();

  // Inicio del mes anterior (UTC)
  const inicioMesAnterior = new Date(
    ahora.getFullYear(), ahora.getMonth() - 1, 1
  ).toISOString();

  // Inicio hace 6 meses (para la gráfica)
  const inicioHace6Meses = new Date(
    ahora.getFullYear(), ahora.getMonth() - 5, 1
  ).toISOString();

  // ── Batch 1: queries independientes en paralelo ────────────────────────────
  const [
    { data: negociosRaw },
    { data: perfilesRaw },
    { data: metodosRaw },
  ] = await Promise.all([
    // Todos los negocios (ordenados del más reciente al más antiguo)
    adminClient
      .from("negocios")
      .select("eCodCompany, tNameCompany, imgCompany, bStateCompany, fhCreateCompany")
      .order("fhCreateCompany", { ascending: false }),

    // Todos los perfiles no-sistemas (para contar usuarios por negocio)
    adminClient
      .from("perfiles")
      .select("eCodUser, tNameUser, tRolUser, fkeCodCompany")
      .neq("tRolUser", "sistemas")
      .not("fkeCodCompany", "is", null),

    // Todos los métodos de pago
    adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, bStatePay")
      .order("bStatePay", { ascending: false }),
  ]);

  const negocios = negociosRaw ?? [];
  const perfiles = perfilesRaw ?? [];
  const metodos  = metodosRaw  ?? [];

  // ── Procesamiento: usuarios por negocio ───────────────────────────────────
  const usuariosPorNegocio = new Map<string, number>();
  const adminPorNegocio    = new Map<string, { tNameUser: string; tEmailUser?: string }>();

  for (const p of perfiles) {
    if (!p.fkeCodCompany) continue;
    // Contar usuarios
    usuariosPorNegocio.set(
      p.fkeCodCompany,
      (usuariosPorNegocio.get(p.fkeCodCompany) ?? 0) + 1
    );
    // Guardar el admin (solo el primero encontrado por negocio)
    if (p.tRolUser === "admin" && !adminPorNegocio.has(p.fkeCodCompany)) {
      adminPorNegocio.set(p.fkeCodCompany, { tNameUser: p.tNameUser });
    }
  }

  // ── Procesamiento: KPIs de negocios ──────────────────────────────────────
  const totalNegocios    = negocios.length;
  const negociosActivos  = negocios.filter((n) => n.bStateCompany === "activo").length;
  const negociosPausados = negocios.filter((n) => n.bStateCompany !== "activo").length;
  const totalUsuarios    = perfiles.length;

  const negociosEsteMes    = negocios.filter((n) => n.fhCreateCompany >= inicioEsteMes).length;
  const negociosMesAnterior = negocios.filter(
    (n) => n.fhCreateCompany >= inicioMesAnterior && n.fhCreateCompany < inicioEsteMes
  ).length;

  const metodosActivosCount = metodos.filter((m) => m.bStatePay).length;

  // ── Procesamiento: tendencia por mes (últimos 6) ──────────────────────────
  const mesesLabels = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const tendenciaMeses: TendenciaMes[] = [];

  for (let i = 5; i >= 0; i--) {
    const d     = new Date(ahora);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const year  = d.getFullYear();
    const month = d.getMonth();

    const inicioMes = new Date(year, month, 1).toISOString();
    const finMes    = new Date(year, month + 1, 1).toISOString();

    const count = negocios.filter(
      (n) => n.fhCreateCompany >= inicioMes && n.fhCreateCompany < finMes
    ).length;

    tendenciaMeses.push({
      label:       i === 0 ? "Este mes" : mesesLabels[month],
      count,
      esMesActual: i === 0,
    });
  }

  // ── Procesamiento: negocios enriquecidos ─────────────────────────────────
  const negociosEnriquecidos: NegocioSistemas[] = negocios.map((n) => ({
    eCodCompany:     n.eCodCompany,
    tNameCompany:    n.tNameCompany,
    imgCompany:      n.imgCompany ?? null,
    bStateCompany:   n.bStateCompany,
    fhCreateCompany: n.fhCreateCompany,
    adminNombre:     adminPorNegocio.get(n.eCodCompany)?.tNameUser ?? null,
    totalUsuarios:   usuariosPorNegocio.get(n.eCodCompany) ?? 0,
  }));

  // Recientes: los 8 más nuevos (ya ordenados por fhCreateCompany DESC)
  const negociosRecientes = negociosEnriquecidos.slice(0, 8);

  // Top por usuarios: los 5 con más usuarios
  const topNegociosPorUsuarios = [...negociosEnriquecidos]
    .sort((a, b) => b.totalUsuarios - a.totalUsuarios)
    .slice(0, 5);

  // ── Métodos de pago ───────────────────────────────────────────────────────
  const metodosPago: MetodoPagoSistemas[] = metodos.map((m) => ({
    eCodPay:   m.eCodPay,
    tNamePay:  m.tNamePay,
    tIconPay:  m.tIconPay,
    bStatePay: m.bStatePay,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SistemasDashboardClient
      totalNegocios={totalNegocios}
      negociosActivos={negociosActivos}
      negociosPausados={negociosPausados}
      totalUsuarios={totalUsuarios}
      metodosActivosCount={metodosActivosCount}
      negociosEsteMes={negociosEsteMes}
      negociosMesAnterior={negociosMesAnterior}
      negociosRecientes={negociosRecientes}
      topNegociosPorUsuarios={topNegociosPorUsuarios}
      metodosPago={metodosPago}
      tendenciaMeses={tendenciaMeses}
    />
  );
}