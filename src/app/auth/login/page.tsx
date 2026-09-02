import { loginSistemas } from "@/lib/actions/auth";
import { PinLoginForm } from "@/components/auth/PinLoginForm";
import Link from "next/link";

export default function LoginSistemasPage() {
  return (
    <div>
      <PinLoginForm
        titulo="Bienvenido"
        subtitulo="Acceso de sistemas"
        accion={loginSistemas}
      />
      <p style={{ textAlign: "center", marginTop: -48, fontSize: 13 }}>
        <Link href="/auth/negocio" style={{ color: "var(--gray)" }}>
          ¿Eres parte de un negocio? Búscalo aquí
        </Link>
      </p>
    </div>
  );
}