"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalConfiguracion } from "./ModalConfiguracion";
import type { ConfigNegocio }    from "@/lib/actions/configuracion";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

interface Props {
  config:     ConfigNegocio;
  catalogo:   MetodoPagoGlobal[];
  activados:  string[];   // eCodPay[] activos para este negocio
  codCompany: string;
}

export function ConfiguracionClient({ config, catalogo, activados, codCompany }: Props) {
  const router  = useRouter();
  const [abierto, setAbierto] = useState(true);

  function handleCerrar() {
    setAbierto(false);
    router.back();
  }

  if (!abierto) return null;

  return (
    <ModalConfiguracion
      config={config}
      catalogo={catalogo}
      activados={activados}
      codCompany={codCompany}
      onCerrar={handleCerrar}
    />
  );
}