"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { Producto } from "@/types";
import { Buscador } from "@/components/ui/Buscador";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "./productos.module.css";
import { toggleEstadoProducto, eliminarProducto } from "@/lib/actions/productos";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { ColumnaTabla, DataTable } from "@/components/ui/DataTable";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { ModalCrearProducto } from "./ModalCrearProducto";
import { ModalVerProducto } from "./ModalVerProducto";
import { ModalEditarProducto } from "./ModalEditarProducto";

interface Props {
  productos: Producto[];
}

export function ProductClient({ productos: inicial }: Props) {
    const [productos, setProductos] = useState<Producto[]>(inicial);
    const [busqueda, setBusqueda] = useState("");
    const [filtros, setFiltros] = useState<FiltrosUsuario>({
        busqueda: "",
        roles: [],
        estados: [],
    });
    const [modalCrear, setModalCrear] = useState(false);
    const [productoVer, setProductoVer] = useState<Producto | null>(null);
    const [productoEditar, setProductoEditar] = useState<Producto | null>(null);
    const [toggleando, setToggleando] = useState<string | null>(null);
    const [seleccionados, setSeleccionados] = useState<string[]>([]);
    const [eliminando, setEliminando] = useState<string | null>(null);


    // ── Filtrado ──────────────────────────────────────────────────────────────
    const filtradas = productos.filter((p) => {
        const texto = filtros.busqueda.toLowerCase();
        const coincideTexto = !texto || p.tNameProduct.toLowerCase().includes(texto);

        const estadoValor = p.bStateProduct ? "activo" : "inactivo";
        const coincideEstado =
        filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

        return coincideTexto && coincideEstado;
    });

    // ── Helpers Supabase ──────────────────────────────────────────────────────
      async function recargar() {
        const supabase = createClient();
        const { data } = await supabase
          .from("productos")
          .select("*")
          .order("eCodProduct", { ascending: true });
        if (data) setProductos(data as Producto[]);
      }
    
      // ── Handlers ──────────────────────────────────────────────────────────────
      function handleProductoCreado(nuevo: Producto) {
          setProductos((prev) => [nuevo, ...prev]);
          setModalCrear(false);
        }
    
      function handleProductoEditado(actualizado: Producto) {
          setProductos((prev) =>
            prev.map((p) => (p.eCodProduct === actualizado.eCodProduct ? actualizado : p))
          );
          setProductoEditar(null);
        }
    
      async function handleToggleEstado(producto: Producto) {
        setToggleando(producto.eCodProduct);
        const result = await toggleEstadoProducto(producto.eCodProduct, !producto.bStateProduct);
        if (!result?.error) {
          setProductos((prev) =>
            prev.map((p) =>
              p.eCodProduct === producto.eCodProduct ? { ...p, bStateProduct: !p.bStateProduct } : p
            )
          );
        }
        setToggleando(null);
      }

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalActivos = productos.filter((p) => p.bStateProduct).length;

    // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Producto>[] = [
    {
      key: "tNameProduct",
      label: "Producto",
      render: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.avatar}>{p.tNameProduct[0].toUpperCase()}</div>
          <span>{p.tNameProduct}</span>
        </div>
      ),
    },
    {
      key: "fhCreateProduct",
      label: "Fecha de creación",
      render: (p) => (
        <span>
          {formatFechaHora(p.fhCreateProduct)}
        </span>
      ),
    },
    {
      key: "fhUpdateProduct",
      label: "Última actualización",
      render: (p) => (
        <span>
          {p.fhUpdateProduct ? formatRelativo(p.fhUpdateProduct) : "Sin cambios"}
        </span>
      ),
    },
    {
      key: "bStateProduct",
      label: "Estado",
      render: (p) => (
        <Badge
          activo={p.bStateProduct}
          onToggle={() => handleToggleEstado(p)}
          toggling={toggleando === p.eCodProduct}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (p) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setProductoVer(p)}>
            <Eye size={18} />
          </ActionBtn>
          <ActionBtn title="Editar" onClick={() => setProductoEditar(p)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(p)}
            loading={eliminando === p.eCodProduct}
            danger
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

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
            boton={{ label: "Nuevo producto", onClick: () => setModalCrear(true)  }}
        />

        {/* Stats */}
      <div className={styles.stats}>
        {[
          { label: "Total productos", value: productos.length, color: "var(--color-primary-dark)" },
          { label: "Activos",          value: totalActivos,      color: "var(--color-primary)" },
          { label: "Inactivos",        value: productos.length - totalActivos, color: "#854F0B" },
        ].map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 16, fontWeight: 400, color: "var(--gray)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar — sin filtro de rol */}
        <TablaToolbar
            filtros={filtros}
            onChange={setFiltros}
            total={filtradas.length}
            ocultarRol
        />

        {/* Tabla */}
        <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(p) => String(p.eCodProduct)}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No se encontraron productos"
        />
        
        {/* Modales */}
        {modalCrear && (
        <ModalCrearProducto
            onClose={() => setModalCrear(false)}
            onCreado={handleProductoCreado}
            onClose={() => setModalCrear(false)}
            onCreado={handleProductoCreado}
        />
        )}
        {productoVer && (
            <ModalVerProducto
                producto={productoVer}
                onClose={() => setProductoVer(null)}
            />
            )}
            {productoEditar && (
            <ModalEditarProducto
                producto={productoEditar}
                onClose={() => setProductoEditar(null)}
                onEditado={handleProductoEditado}
            />
            )}
    </div>

    
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""} ${loading ? styles.actionBtnLoading : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}