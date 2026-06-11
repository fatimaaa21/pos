import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/auth", "/conoce-kivi"];

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !esRutaPublica(pathname)) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && pathname.startsWith("/auth")) {
    const { data: perfil } = await supabase
      .from("perfiles").select("tRolUser").eq("eCodUser", user.id).single();

    if (perfil?.tRolUser === "sistemas") return NextResponse.redirect(new URL("/sistemas/dashboard", request.url));
    if (perfil?.tRolUser === "admin") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    return NextResponse.redirect(new URL("/empleado/menu", request.url));
  }

  if (user && pathname.startsWith("/sistemas")) {
    const { data: perfil } = await supabase
      .from("perfiles").select("tRolUser").eq("eCodUser", user.id).single();
    if (perfil?.tRolUser !== "sistemas") return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: perfil } = await supabase
      .from("perfiles").select("tRolUser").eq("eCodUser", user.id).single();
    if (perfil?.tRolUser !== "admin") return NextResponse.redirect(new URL("/empleado/menu", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};