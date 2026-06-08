"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { Producto, Categoria } from "@/types";
import { PageHeader }  from "@/components/ui/PageHeader";
import { StatCards }   from "@/components/ui/Statscards";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge }       from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { toggleEstadoProducto, eliminarProducto } from "@/lib/actions/productos";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { ModalCrearProductoImpresion }  from "./ModalCrearProductoImpresion";
import { ModalEditarProductoImpresion } from "./ModalEditarProductoImpresion";
import { ModalVerProducto } from "./ModalVerProducto";
import { StatCards as _StatCards } from "@/components/ui/Statscards";
import toast from "react-hot-toast";
import styles from "./productos.module.css";

interface Props {
  productos:   Producto[];
  categorias:  Categoria[];
  tipoNegocio: "general" | "impresion";
}

export function ProductosImpresionClient({ productos: inicial, categorias }: Props) {
  const [productos,       setProductos]       = useState<Producto[]>(inicial);
  const [imgTimestamps,   setImgTimestamps]    = useState<Record<string, number>>({});
  const [filtros,         setFiltros]          = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], categorias: [],
  });
  const [modalCrear,        setModalCrear]        = useState(false);
  const [productoVer,       setProductoVer]       = useState<Producto | null>(null);
  const [productoEditar,    setProductoEditar]    = useState<Producto | null>(null);
  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null);
  const [toggleando,        setToggleando]        = useState<string | null>(null);
  const [eliminando,        setEliminando]        = useState<string | null>(null);
  const [seleccionados,     setSeleccionados]     = useState<string[]>([]);

  const categoriasMap = new Map(categorias.map((c) => [c.eCodCategory, c.tNameCategory]));

  const opcionesCategorias = Array.from(
    new Map(
      productos
        .filter((p) => p.fkeCodCategory)
        .map((p) => [
          p.fkeCodCategory!,
          {
            value: p.fkeCodCategory!,
            label: categoriasMap.get(p.fkeCodCategory!) ?? p.fkeCodCategory!,
          },
        ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = productos.filter((p) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto  = !texto || p.tNameProduct.toLowerCase().includes(texto);
    const estadoValor    = p.bStateProduct ? "activo" : "inactivo";
    const coincideEstado = filtros.estados.length === 0 || filtros.estados.includes(estadoValor);
    const coincideCategoria =
      !filtros.categorias?.length ||
      (p.fkeCodCategory != null && filtros.categorias.includes(p.fkeCodCategory));
    return coincideTexto && coincideEstado && coincideCategoria;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleProductoCreado(nuevo: Producto) {
    setProductos((prev) => [nuevo, ...prev]);
    setModalCrear(false);
    toast.success(`"${nuevo.tNameProduct}" creado`);
  }

  function handleProductoEditado(actualizado: Producto) {
    setProductos((prev) =>
      prev.map((p) => p.eCodProduct === actualizado.eCodProduct ? actualizado : p)
    );
    setImgTimestamps((prev) => ({ ...prev, [actualizado.eCodProduct]: Date.now() }));
    setProductoEditar(null);
    toast.success(`"${actualizado.tNameProduct}" actualizado`);
  }

  async function handleToggle(producto: Producto) {
    setToggleando(producto.eCodProduct);
    const result = await toggleEstadoProducto(producto.eCodProduct, !producto.bStateProduct);
    if (!result?.error) {
      setProductos((prev) =>
        prev.map((p) =>
          p.eCodProduct === producto.eCodProduct
            ? { ...p, bStateProduct: !p.bStateProduct }
            : p
        )
      );
      toast.success(`"${producto.tNameProduct}" ${!producto.bStateProduct ? "activado" : "desactivado"}`);
    } else {
      toast.error(`No se pudo cambiar el estado: ${result.error}`);
    }
    setToggleando(null);
  }

  async function confirmarEliminar() {
    if (!productoAEliminar) return;
    setEliminando(productoAEliminar.eCodProduct);
    const result = await eliminarProducto(productoAEliminar.eCodProduct);
    setEliminando(null);
    if (!result?.error) {
      setProductos((prev) =>
        prev.filter((p) => p.eCodProduct !== productoAEliminar.eCodProduct)
      );
      toast.success(`"${productoAEliminar.tNameProduct}" eliminado`);
      setProductoAEliminar(null);
    } else {
      toast.error(result.error);
      setProductoAEliminar(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivos = productos.filter((p) => p.bStateProduct).length;
  const porMedida    = productos.filter((p) => p.tipo_producto === "medida").length;
  const porUnidad    = productos.filter((p) => p.tipo_producto === "unidad").length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Producto>[] = [
    {
      key:   "tNameProduct",
      label: "Producto",
      render: (p) => {
        const ts = imgTimestamps[p.eCodProduct];
        return (
          <div className={styles.avatar} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {p.ImgProduct && (
              <img src={ts ? `${p.ImgProduct.split("?")[0]}?t=${ts}` : p.ImgProduct.split("?")[0]} alt={p.tNameProduct} />
            )}
            <span>{p.tNameProduct}</span>
          </div>
        );
      },
    },
    {
      key:   "fkeCodCategory",
      label: "Categoría",
      render: (p) => (
        <span>{p.fkeCodCategory ? categoriasMap.get(p.fkeCodCategory) ?? "—" : "—"}</span>
      ),
    },
    {
      key:   "tipo_producto",
      label: "Tipo",
      render: (p) => (
        <Badge variante={p.tipo_producto === "medida" ? "sistemas" : "empleado"} dot={false}>
          {p.tipo_producto === "medida" ? "Por medida" : "Por unidad"}
        </Badge>
      ),
    },
    {
      key:   "ePrecioM2",
      label: "Precio",
      render: (p) => {
        if (p.tipo_producto === "medida") {
          return (
            <span>
              {(p.ePrecioM2 ?? 0).toLocaleString("es-MX", {
                style: "currency", currency: "MXN",
              })}{" "}
              <span style={{ fontSize: 11, color: "var(--gray)" }}>/m²</span>
            </span>
          );
        }
        return (
          <span>
            {p.ePriceProduct.toLocaleString("es-MX", {
              style: "currency", currency: "MXN",
            })}
          </span>
        );
      },
    },
    {
      key:   "eCostProduct",
      label: "Costo",
      render: (p) => (
        <span>
          {p.eCostProduct.toLocaleString("es-MX", {
            style: "currency", currency: "MXN",
          })}
          {p.tipo_producto === "medida" && (
            <span style={{ fontSize: 11, color: "var(--gray)" }}> /m²</span>
          )}
        </span>
      ),
    },
    {
      key:   "bStateProduct",
      label: "Estado",
      render: (p) => (
        <Badge
          activo={p.bStateProduct}
          onToggle={() => handleToggle(p)}
          toggling={toggleando === p.eCodProduct}
        />
      ),
    },
    {
      key:   "acciones",
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
            danger
            loading={eliminando === p.eCodProduct}
            onClick={() => setProductoAEliminar(p)}
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Productos"
        descripcion="Gestiona los productos del negocio"
        boton={{ label: "Nuevo producto", onClick: () => setModalCrear(true) }}
      />

      <StatCards stats={[
        { label: "Total productos", value: productos.length, variante: "primary" },
        { label: "Activos",         value: totalActivos,      variante: "success" },
        { label: "Por medida",      value: porMedida,         variante: "accent"  },
        { label: "Por unidad",      value: porUnidad,         variante: "neutral" },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
        ocultarRol
        opcionesCategorias={opcionesCategorias}
      />

      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={(p) => p.eCodProduct}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No se encontraron productos"
      />

      {modalCrear && (
        <ModalCrearProductoImpresion
          onClose={() => setModalCrear(false)}
          onCreado={handleProductoCreado}
          categorias={categorias}
        />
      )}
      {productoVer && (
        <ModalVerProducto
          producto={productoVer}
          categorias={categorias}
          onClose={() => setProductoVer(null)}
        />
      )}
      {productoEditar && (
        <ModalEditarProductoImpresion
          producto={productoEditar}
          categorias={categorias}
          onClose={() => setProductoEditar(null)}
          onEditado={handleProductoEditado}
        />
      )}
      {productoAEliminar && (
        <ToastConfirmarEliminar
          tipo="producto"
          nombre={productoAEliminar.tNameProduct}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setProductoAEliminar(null)}
          cargando={eliminando === productoAEliminar.eCodProduct}
        />
      )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title:    string;
  onClick:  () => void;
  danger?:  boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}