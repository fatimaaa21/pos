import { createClient } from "@/lib/supabase/server";
import { NegociosClient, type NegocioConAdmin } from "./NegociosClient";

export default async function SistemasNegociosPage() {
  const supabase = await createClient();

  const { data: negocios, error } = await supabase
    .from("negocios")
    .select("*")
    .order("fhCreateCompany", { ascending: false });

  if (error) console.error("Error cargando negocios:", error);

  // Traer todos los admins con su negocio vinculado
  const { data: admins } = await supabase
    .from("perfiles")
    .select("eCodUser, tNameUser, tEmailUser, eCodeUser, fkeCodCompany")
    .eq("tRolUser", "admin")
    .not("fkeCodCompany", "is", null);

  // Contar usuarios por negocio (todos los roles menos sistemas)
  const { data: conteos } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .neq("tRolUser", "sistemas")
    .not("fkeCodCompany", "is", null);

  const totalesPorNegocio = (conteos ?? []).reduce<Record<string, number>>(
    (acc, p) => {
      if (p.fkeCodCompany) {
        acc[p.fkeCodCompany] = (acc[p.fkeCodCompany] ?? 0) + 1;
      }
      return acc;
    },
    {}
  );

  // Un admin por negocio (el primero que aparezca)
  const adminsPorNegocio = (admins ?? []).reduce<Record<string, any>>(
    (acc, a) => {
      if (a.fkeCodCompany && !acc[a.fkeCodCompany]) {
        acc[a.fkeCodCompany] = a;
      }
      return acc;
    },
    {}
  );

  const negociosConDatos: NegocioConAdmin[] = (negocios ?? []).map((n: any) => ({
  eCodCompany:     n.eCodCompany,
  tNameCompany:    n.tNameCompany,
  tSlugCompany:    n.tSlugCompany,
  imgCompany:      n.imgCompany,
  moneda:          n.moneda,
  zona_horaria:    n.zona_horaria,
  tipo_negocio:    n.tipo_negocio ?? "general",
  bStateCompany:   n.bStateCompany,
  fhCreateCompany: n.fhCreateCompany,
  admin:           adminsPorNegocio[n.eCodCompany] ?? null,
  totalUsuarios:   totalesPorNegocio[n.eCodCompany] ?? 0,
}));
console.log("columnas DB:", Object.keys(negocios?.[0] ?? {}));

  return <NegociosClient negocios={negociosConDatos} />;
}