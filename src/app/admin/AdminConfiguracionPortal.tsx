// src/app/admin/AdminConfiguracionPortal.tsx
"use client";

import { useEffect, useState } from "react";
import { useConfiguracionStore }                from "@/lib/stores/configuracion";
import { ModalConfiguracion }                   from "./configuracion/ModalConfiguracion";
import { getConfigNegocio, type ConfigNegocio } from "@/lib/actions/configuracion";
import { getMetodosParaAdmin, type MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

interface DatosConfig {
  config:     ConfigNegocio;
  catalogo:   MetodoPagoGlobal[];
  activados:  string[];
  codCompany: string;
}

/**
 * Portal del modal de configuración del negocio.
 *
 * Se monta una sola vez en AdminLayout.
 * Cuando el store pone `abierta = true` (desde el Sidebar),
 * carga los datos con server actions y renderiza el modal
 * sobre cualquier página del área /admin.
 */
export function AdminConfiguracionPortal() {
  const { abierta, cerrar } = useConfiguracionStore();

  const [datos,    setDatos]    = useState<DatosConfig | null>(null);
  const [cargando, setCargando] = useState(false);

  // Cada vez que el modal se abre, carga datos frescos
  useEffect(() => {
    if (!abierta) return;

    let cancelado = false;
    setCargando(true);

    async function cargar() {
      const [config, { catalogo, activados, codCompany }] = await Promise.all([
        getConfigNegocio(),
        getMetodosParaAdmin(),
      ]);

      if (cancelado) return;

      if (!config) {
        // No debería ocurrir, pero si falla la carga simplemente cerramos
        cerrar();
        setCargando(false);
        return;
      }

      // Descarta métodos activados que ya no existan en el catálogo
      const codsValidos     = new Set(catalogo.map((m) => m.eCodPay));
      const activadosLimpios = activados.filter((id) => codsValidos.has(id));

      setDatos({ config, catalogo, activados: activadosLimpios, codCompany });
      setCargando(false);
    }

    cargar();
    return () => { cancelado = true; };
  }, [abierta]);

  function handleCerrar() {
    cerrar();
    // Limpia los datos con un pequeño delay para que la animación de
    // salida del modal no muestre un destello de estado vacío
    setTimeout(() => setDatos(null), 250);
  }

  // No está abierto → no monta nada en el DOM
  if (!abierta) return null;

  // Está abierto pero los datos aún cargan → espera sin mostrar nada
  // (la petición es tan rápida que el usuario casi no lo nota)
  if (cargando || !datos) return null;

  return (
    <ModalConfiguracion
      config={datos.config}
      catalogo={datos.catalogo}
      activados={datos.activados}
      codCompany={datos.codCompany}
      onCerrar={handleCerrar}
    />
  );
}