import { redirect }      from "next/navigation";
import { createClient }  from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies }       from "next/headers";
import { Sidebar }       from "./Sidebar";
import type { Perfil, Sucursal } from "@/types";
import styles            from "./AppLayout.module.css";

const COOKIE_SUCURSAL = "kivi_sucursal_activa";

interface AppLayoutProps {
  children: React.ReactNode;
}

export async function AppLayout({ children }: AppLayoutProps) {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil) redirect("/auth/login");

  let negocio: { tNameCompany: string; imgCompany: string | null } | null = null;
  let modulosActivos: string[] = [];
  let sucursales:     Sucursal[] = [];
  let sucursalActiva: string | null = null;

  if (perfil.fkeCodCompany) {
    const [negocioRes, modulosRes, sucursalesRes] = await Promise.all([
      supabase
        .from("negocios")
        .select("tNameCompany, imgCompany")
        .eq("eCodCompany", perfil.fkeCodCompany)
        .single(),
      adminClient
        .from("modulos_tenant")
        .select("tModulo")
        .eq("fkeCodCompany", perfil.fkeCodCompany)
        .eq("bStateModulo", true),
      adminClient
        .from("sucursales")
        .select("*")
        .eq("fkeCodCompany", perfil.fkeCodCompany)
        .eq("bStateSucursal", true)
        .order("fhCreateSucursal"),
    ]);

    if (negocioRes.data) {
      negocio = {
        tNameCompany: negocioRes.data.tNameCompany,
        imgCompany:   negocioRes.data.imgCompany ?? null,
      };
    }

    modulosActivos = (modulosRes.data ?? []).map((m: any) => m.tModulo);
    sucursales     = (sucursalesRes.data as Sucursal[]) ?? [];

    // Cookie de sucursal activa (solo relevante para admin)
    if (perfil.tRolUser === "admin") {
      const cookieStore  = await cookies();
      const cookieVal    = cookieStore.get(COOKIE_SUCURSAL)?.value ?? null;
      // Validar que la cookie apunta a una sucursal del negocio
      const valida = sucursales.some((s) => s.eCodSucursal === cookieVal);
      sucursalActiva = valida ? cookieVal : null;
    }
  }

  return (
    <div className={styles.wrapper}>
      <Sidebar
        perfil={perfil as Perfil}
        negocio={negocio}
        modulosActivos={modulosActivos}
        sucursales={sucursales}
        sucursalActiva={sucursalActiva}
      />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}