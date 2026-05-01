"use client";

import { useState } from "react";
import type { Producto } from "@/types";
import { Buscador } from "@/components/ui/Buscador";
import { PageHeader } from "@/components/ui/PageHeader";


interface Props {
  productos: Producto[];
}

export function ProductClient({ productos: inicial }: Props) {
    const [productos, setProductos] = useState(inicial);
    const [busqueda, setBusqueda] = useState("");


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
            titulo="Productos"
            descripcion="Gestiona los productos"
            boton={{ label: "Nuevo producto" }}
        />
    </div>
  );
}