import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";
import type { Perfil } from "@/types";
import styles from "./AppLayout.module.css";

interface AppLayoutProps {
  children: React.ReactNode;
}

export async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil) redirect("/auth/login");

  // Traer datos del negocio si el usuario tiene uno asignado
  let negocio: { tNameCompany: string; imgCompany: string | null } | null = null;

  if (perfil.fkeCodCompany) {
    const { data } = await supabase
      .from("negocios")
      .select("tNameCompany, imgCompany")
      .eq("eCodCompany", perfil.fkeCodCompany)
      .single();

    if (data) {
      negocio = {
        tNameCompany: data.tNameCompany,
        imgCompany:   data.imgCompany ?? null,
      };
    }
  }

  return (
    <div className={styles.wrapper}>
      <Sidebar perfil={perfil as Perfil} negocio={negocio} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}