"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { Producto, Categoria } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "./productos.module.css";
import { toggleEstadoProducto, eliminarProducto } from "@/lib/actions/productos";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { ColumnaTabla, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { ModalCrearProducto } from "./ModalCrearProducto";
import { ModalVerProducto } from "./ModalVerProducto";
import { ModalEditarProducto } from "./ModalEditarProducto";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { StatCards } from "@/components/ui/Statscards";

interface Props {
  productos: Producto[];
}

export function ProductClient({ productos: inicial }: Props) {
  const [productos, setProductos] = useState<Producto[]>(inicial);
  const [imgTimestamps, setImgTimestamps] = useState<Record<string, number>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles: [],
    estados: [],
    categorias: [],
  });
  const [modalCrear, setModalCrear] = useState(false);
  const [productoVer, setProductoVer] = useState<Producto | null>(null);
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null);
  const [toggleando, setToggleando] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null);

  useEffect(() => {
    async function cargarCategorias() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categorias")
        .select("eCodCategory, tNameCategory")
        .order("tNameCategory");

      if (data) setCategorias(data as Categoria[]);
      if (error) console.error("Error cargando categorías:", error.message);
    }
    cargarCategorias();
  }, []);

  // ── Mapa de categorías para labels ───────────────────────────────────────
  const categoriasMap = new Map(categorias.map((c) => [c.eCodCategory, c.tNameCategory]));

  // ── Opciones de categoría: solo las que realmente tienen productos ────────
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
  const filtradas = productos.filter((p) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto = !texto || p.tNameProduct.toLowerCase().includes(texto);

    const estadoValor = p.bStateProduct ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    const coincideCategoria =
      !filtros.categorias?.length ||
      (p.fkeCodCategory != null && filtros.categorias.includes(p.fkeCodCategory));

    return coincideTexto && coincideEstado && coincideCategoria;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleProductoCreado(nuevo: Producto) {
    setProductos((prev) => [nuevo, ...prev]);
    setModalCrear(false);
  }

  function handleProductoEditado(actualizado: Producto) {
    setProductos((prev) =>
      prev.map((p) => (p.eCodProduct === actualizado.eCodProduct ? actualizado : p))
    );
    setImgTimestamps((prev) => ({ ...prev, [actualizado.eCodProduct]: Date.now() }));
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

  function handleEliminar(producto: Producto) {
  setProductoAEliminar(producto);
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
    setProductoAEliminar(null);
  } else {
    // El error se mostrará dentro del mismo modal vía el prop error del Modal.
    // Si prefieres, puedes agregar un estado de error local aquí.
    alert(`Error al eliminar: ${result.error}`);
    setProductoAEliminar(null);
  }
}
  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivos = productos.filter((p) => p.bStateProduct).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Producto>[] = [
    {
      key: "tNameProduct",
      label: "Producto",
      render: (p) => {
        const ts = imgTimestamps[p.eCodProduct] ?? Date.now();
        return (
          <div className={styles.avatar} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {p.ImgProduct ? (
              <img
                src={`${p.ImgProduct.split("?")[0]}?t=${ts}`}
                alt={p.tNameProduct}
              />
            ) : null}
            <span>{p.tNameProduct}</span>
          </div>
        );
      },
    },
    {
      key: "fkeCodCategory",
      label: "Categoría",
      render: (p) => (
        <span>
          {p.fkeCodCategory ? categoriasMap.get(p.fkeCodCategory) ?? "—" : "—"}
        </span>
      ),
    },
    {
      key: "ePriceProduct",
      label: "Precio al público",
      render: (p) => (
        <span>
          {p.ePriceProduct.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
        </span>
      ),
    },
    {
      key: "eCostProduct",
      label: "Costo de producción",
      render: (p) => (
        <span>
          {p.eCostProduct.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
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
      <div className="header" />

      <PageHeader
        titulo="Productos"
        descripcion="Gestiona los productos"
        boton={{ label: "Nuevo producto", onClick: () => setModalCrear(true) }}
      />

      <StatCards stats={[
        { label: "Total productos", value: productos.length,                   variante: "primary" },
        { label: "Activos",         value: totalActivos,                        variante: "success" },
        { label: "Inactivos",       value: productos.length - totalActivos,     variante: "accent"  },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        opcionesCategorias={opcionesCategorias}
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(p) => String(p.eCodProduct)}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No se encontraron productos"
      />

      {modalCrear && (
        <ModalCrearProducto
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
        <ModalEditarProducto
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
      {loading ? "" : children}
    </button>
  );
}