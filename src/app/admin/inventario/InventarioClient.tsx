"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { crearInventario } from "@/lib/actions/inventario";
import type { Inventario } from "@/types";  
import { Buscador } from "@/components/ui/Buscador";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { FiltrosUsuario, TablaToolbar } from "@/components/ui/TablaToolbar";

interface Props {
  inventario: Inventario[];
}

export function InventarioClient({ inventario }: Props) {
    const [busqueda, setBusqueda] = useState("");
    const [filtros, setFiltros] = useState<FiltrosUsuario>({
        busqueda: "",
        roles: [],
        estados: [],
    });

  // ── Filtrado ──────────────────────────────────────────────────────────────
    const filtradas = inventario.filter((c) => {
    const texto = filtros.busqueda.toLowerCase();
    //const coincideTexto = !texto || c.tNameInventory.toLowerCase().includes(texto);
    const estadoValor = c.bStateInventory ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);
    return coincideTexto && coincideEstado;
  });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        fkeCodProduct: "",
        nCantIngresada: 0,
        nStockMinimo: 0,
        fhCreateMov: "",
    });

  return (
    <div className="container">
        <div className="header">
            <Buscador
                valor={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar usuario..."
            />
        </div>

        <PageHeader
            titulo="Inventario"
            descripcion="Gestiona el inventario"
            boton={{ label: "Agregar stock", onClick: () => setModalCrear(true)  }}
        />

        {/* Stats */}
        <StatCards stats={[
        { label: "Productos en inventario",  value: inventario.length, variante: "primary" },
        { label: "Disponibles",         value: inventario.filter((p) => p.nCantIngresada > 0).length, variante: "success" },
        { label: "Stock bajo",         value: inventario.length - inventario.filter((p) => p.nCantIngresada > 0).length, variante: "accent" },
        { label: "Agotados",         value: inventario.length - inventario.filter((p) => p.nCantIngresada > 0).length, variante: "accent" },
        ]} />

        {/* Toolbar — sin filtro de rol */}
        <TablaToolbar
            filtros={filtros}
            onChange={setFiltros}
            total={filtradas.length}
            ocultarRol
        />
    </div>
    );
}