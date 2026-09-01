import { createAdminClient } from "@/lib/supabase/admin";
import { loginNegocio } from "@/lib/actions/auth";
import { PinLoginForm } from "@/components/auth/PinLoginForm";

export default async function LoginNegocioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const adminClient = createAdminClient();
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tNameCompany, bStateCompany")
    .eq("tSlugCompany", slug)
    .maybeSingle();

  if (!negocio || negocio.bStateCompany !== "activo") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          textAlign: "center",
          padding: 16,
        }}
      >
        <p>No encontramos ese negocio.</p>
        <a href="/auth/negocio" style={{ color: "var(--color-primary)" }}>
          ¿No encuentras tu negocio?
        </a>
      </div>
    );
  }

  // Server Action con el slug ya vinculado — PinLoginForm solo necesita pasar el código.
  const accion = loginNegocio.bind(null, slug);

  return (
    <PinLoginForm
      titulo={`Bienvenido a ${negocio.tNameCompany}`}
      subtitulo="Ingresa tu código de acceso"
      accion={accion}
    />
  );
}