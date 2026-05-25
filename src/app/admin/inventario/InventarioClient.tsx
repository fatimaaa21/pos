"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2, Pencil } from "lucide-react";
import type { Inventario } from "@/types";
import { Buscador } from "@/components/ui/Buscador";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { type FiltrosUsuario, TablaToolbar } from "@/components/ui/TablaToolbar";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalAgregarStock } from "./ModalAgregarStock";
import { ModalVerStock } from "./ModalVerStock";
import { ModalEditarStock } from "./ModalEditarStock";
import { eliminarInventario, toggleEstadoInventario } from "@/lib/actions/inventario";
import { getEstadoStock } from "@/types";
import styles from "./inventario.module.css";

export interface InventarioConProducto extends Inventario {
  productos?: {
    tNameProduct: string;
    ImgProduct?: string;
    ePriceProduct: number;
    categorias?: {
      eCodCategory: string;
      tNameCategory: string;
    };
  };
}

interface Props {
  inventario: InventarioConProducto[];
}

export function InventarioClient({ inventario: inicial }: Props) {
  const [inventario, setInventario] = useState<InventarioConProducto[]>(inicial);
  const [busqueda, setBusqueda]     = useState("");
  const router = useRouter();
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], categorias: [], stocks: [],
  });
  const [modalAgregar, setModalAgregar]   = useState(false);
  const [stockVer, setStockVer]           = useState<InventarioConProducto | null>(null);
  const [stockEditar, setStockEditar]     = useState<InventarioConProducto | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [eliminando, setEliminando]       = useState<string | null>(null);
  const [toggleando, setToggleando]       = useState<string | null>(null);

  const opcionesCategorias = Array.from(
    new Map(
      inventario
        .filter((c) => c.productos?.categorias)
        .map((c) => [
          c.productos!.categorias!.eCodCategory,
          { value: c.productos!.categorias!.eCodCategory, label: c.productos!.categorias!.tNameCategory },
        ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const filtradas = inventario.filter((c) => {
    const texto          = filtros.busqueda.toLowerCase();
    const nombreProducto = c.productos?.tNameProduct?.toLowerCase() ?? "";
    const nombreCategoria = c.productos?.categorias?.tNameCategory?.toLowerCase() ?? "";
    const coincideTexto  = !texto || nombreProducto.includes(texto) || nombreCategoria.includes(texto);

    const estadoValor    = c.bStateInventory ? "activo" : "inactivo";
    const coincideEstado = filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    const codCategoria      = c.productos?.categorias?.eCodCategory ?? "";
    const coincideCategoria = !filtros.categorias?.length || filtros.categorias.includes(codCategoria);

    const estadoStock  = getEstadoStock(c.eCantRestante, c.eStockMinimo, c.bUnlimitedInventory);
    const coincideStock = !filtros.stocks?.length || filtros.stocks.includes(estadoStock as any);

    return coincideTexto && coincideEstado && coincideCategoria && coincideStock;
  });

  function handleStockAgregado(nuevo: InventarioConProducto) {
    setInventario((prev) => [nuevo, ...prev]);
    setModalAgregar(false);
    router.refresh();
  }

  function handleStockEditado(actualizado: InventarioConProducto) {
    setInventario((prev) =>
      prev.map((c) => c.eCodInventory === actualizado.eCodInventory ? { ...actualizado } : c)
    );
    setStockEditar(null);
    router.refresh();
  }

  async function handleEliminar(item: InventarioConProducto) {
    if (!confirm("¿Eliminar este registro de inventario? Esta acción no se puede deshacer.")) return;
    setEliminando(item.eCodInventory);
    const result = await eliminarInventario(item.eCodInventory);
    if (!result?.error) {
      setInventario((prev) => prev.filter((i) => i.eCodInventory !== item.eCodInventory));
    }
    setEliminando(null);
  }

  async function handleToggle(item: InventarioConProducto) {
    setToggleando(item.eCodInventory);
    const result = await toggleEstadoInventario(item.eCodInventory, !item.bStateInventory);
    if (!result?.error) {
      setInventario((prev) =>
        prev.map((i) =>
          i.eCodInventory === item.eCodInventory
            ? { ...i, bStateInventory: !i.bStateInventory }
            : i
        )
      );
    }
    setToggleando(null);
  }

  const ilimitados   = inventario.filter((p) => p.bUnlimitedInventory).length;
  const disponibles = inventario.filter(
    (p) => !p.bUnlimitedInventory && getEstadoStock(p.eCantRestante, p.eStockMinimo) === "disponible"
  ).length;
  const stockBajo = inventario.filter(
    (p) => !p.bUnlimitedInventory && getEstadoStock(p.eCantRestante, p.eStockMinimo) === "bajo"
  ).length;
  const agotados = inventario.filter(
    (p) => !p.bUnlimitedInventory && getEstadoStock(p.eCantRestante, p.eStockMinimo) === "agotado"
  ).length;

  const columnas: ColumnaTabla<InventarioConProducto>[] = [
    {
      key: "tNameProduct",
      label: "Producto",
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.avatar}>
            {c.productos?.ImgProduct ? (
              <img
                src={c.productos.ImgProduct}
                alt={c.productos.tNameProduct ?? "Producto"}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : <span>📦</span>}
          </div>
          <span>{c.productos?.tNameProduct ?? "Sin nombre"}</span>
        </div>
      ),
    },
    {
      key: "tNameCategory",
      label: "Categoría",
      render: (c) => <span>{c.productos?.categorias?.tNameCategory ?? "Sin categoría"}</span>,
    },
    {
      key: "eCantIngresada",
      label: "Ingresadas",
      render: (c) => (
        <span style={{ color: c.bUnlimitedInventory ? "var(--gray)" : undefined }}>
          {c.bUnlimitedInventory ? "—" : c.eCantIngresada}
        </span>
      ),
    },
    {
      key: "eCantVendida",
      label: "Vendidas",
      render: (c) => <span>{c.eCantVendida ?? 0}</span>,
    },
    {
      key: "eCantRestante",
      label: "Restantes",
      render: (c) => {
        if (c.bUnlimitedInventory) {
          return <Badge variante="ilimitado" dot={false}>Ilimitado</Badge>;
        }
        const estado   = getEstadoStock(c.eCantRestante, c.eStockMinimo);
        const variante = estado === "disponible" ? "disponible" : estado === "bajo" ? "bajo" : "agotado";
        return <Badge variante={variante} dot={false}>{c.eCantRestante ?? 0}</Badge>;
      },
    },
    {
      key: "ePriceProduct",
      label: "Precio",
      render: (c) => <span>$ {c.productos?.ePriceProduct?.toFixed(2) ?? "—"}</span>,
    },
    {
      key: "bStateInventory",
      label: "Estado",
      render: (c) => (
        <Badge
          activo={c.bStateInventory}
          onToggle={() => handleToggle(c)}
          toggling={toggleando === c.eCodInventory}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (c) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setStockVer(c)}>
            <Eye size={18} />
          </ActionBtn>
          {!c.bUnlimitedInventory && (
            <ActionBtn title="Agregar unidades" onClick={() => setStockEditar(c)}>
              <Pencil size={18} />
            </ActionBtn>
          )}
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(c)}
            loading={eliminando === c.eCodInventory}
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
        <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar producto..." />
      </div>

      <PageHeader
        titulo="Inventario"
        descripcion="Control de stock por turno"
        boton={{ label: "Agregar stock", onClick: () => setModalAgregar(true) }}
      />

      <StatCards stats={[
        { label: "En inventario", value: inventario.length, variante: "primary" },
        { label: "Disponibles",   value: disponibles,         variante: "success" },
        { label: "Ilimitados",   value: ilimitados,          variante: "neutral" },
        { label: "Stock bajo",    value: stockBajo,            variante: "warning" },
        { label: "Agotados",      value: agotados,             variante: "error"   },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        opcionesCategorias={opcionesCategorias}
        mostrarStock
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(c) => c.eCodInventory}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay productos en inventario"
      />

      {modalAgregar && (
        <ModalAgregarStock
          onClose={() => setModalAgregar(false)}
          onAgregado={handleStockAgregado}
        />
      )}
      {stockVer && (
        <ModalVerStock inventario={stockVer} onClose={() => setStockVer(null)} />
      )}
      {stockEditar && (
        <ModalEditarStock
          inventario={stockEditar}
          onClose={() => setStockEditar(null)}
          onEditado={handleStockEditado}
        />
      )}
    </div>
  );
}

function ActionBtn({ children, title, onClick, danger, loading }: {
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
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}