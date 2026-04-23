"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error, data } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

   // Agrega esta línea temporal
  console.log("ERROR SUPABASE:", error);
  console.log("DATA:", data);

  if (error) {
    return { error: "Correo o contraseña incorrectos" };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", data.user.id)
    .single();

  revalidatePath("/", "layout");

  if (perfil?.rol === "admin") {
    redirect("/admin/dashboard");
  } else {
    redirect("/empleado/inventario");
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}