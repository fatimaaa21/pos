"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalConfiguracion } from "./ModalConfiguracion";
import type { ConfigNegocio } from "@/lib/actions/configuracion";

interface Props {
  config: ConfigNegocio;
}

export function ConfiguracionClient({ config }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(true);

  function handleCerrar() {
    setAbierto(false);
    router.back();
  }

  function handleGuardado(nueva: ConfigNegocio) {
    // Podrías actualizar estado global aquí si usas zustand/context
    console.log("Configuración guardada:", nueva);
  }

  if (!abierto) return null;

  return (
    <ModalConfiguracion
      config={config}
      onCerrar={handleCerrar}
      onGuardado={handleGuardado}
    />
  );
}