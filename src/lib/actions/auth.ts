"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const codigo = formData.get("codigo") as string;

  // 1. Buscar usuario por código de 4 dígitos (eCodeUser)
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("tEmailUser, tRolUser")
    .eq("eCodeUser", codigo)
    .eq("bStateUser", true)
    .single();

  if (perfilError || !perfil) {
    return { error: "Código incorrecto" };
  }

  // 2. Login con email encontrado + contraseña interna
  const sufijo = process.env.PIN_SECRET_SUFFIX ?? "PAN_SECRET_2024";
  const passwordInterna = `${codigo}${sufijo}`;

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: perfil.tEmailUser,
    password: passwordInterna,
  });

  if (authError) {
    return { error: "Código incorrecto" };
  }

  revalidatePath("/", "layout");

  if (perfil.tRolUser === "sistemas") {
  redirect("/sistemas/dashboard");
  }
  if (perfil.tRolUser === "admin") {
    redirect("/admin/dashboard");
  }
  redirect("/empleado/menu");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}