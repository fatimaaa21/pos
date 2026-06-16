import { redirect }      from "next/navigation";
import { createClient }  from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar }       from "./Sidebar";
import type { Perfil }   from "@/types";
import styles            from "./AppLayout.module.css";

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

  if (perfil.fkeCodCompany) {
    const [negocioRes, modulosRes] = await Promise.all([
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
    ]);

    if (negocioRes.data) {
      negocio = {
        tNameCompany: negocioRes.data.tNameCompany,
        imgCompany:   negocioRes.data.imgCompany ?? null,
      };
    }

    modulosActivos = (modulosRes.data ?? []).map((m: any) => m.tModulo);
  }

  return (
    <div className={styles.wrapper}>
      <Sidebar
        perfil={perfil as Perfil}
        negocio={negocio}
        modulosActivos={modulosActivos}
      />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}