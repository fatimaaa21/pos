export type Rol = "admin" | "empleado" | "sistemas";

export interface Perfil {
  fkeCodCompany: string | null;
  fkeCodSucursal: string | null;
  eCodUser: string;
  tNameUser: string;
  tEmailUser: string;
  tRolUser: Rol;
  bStateUser: boolean;
  eCodeUser: string;
  fhCreateUser: string;
  fhUpdateUser?: string;
}

export interface Negocio {
  eCodCompany: string;
  tNameCompany: string;
  tSlugCompany: string;
  imgCompany?: string;
  moneda: string;
  zona_horaria: string;
  bstateCompany: boolean;
  fhCreateCompany: string;
}

export interface Categoria {
  fkeCodCompany: string;
  eCodCategory: string;
  tNameCategory: string;
  ImgCategory?: string;
  fhCreateCategory?: string;
  fhUpdateCategory?: string;
  bStateCategory?: boolean;
  productos?: ProductoResumen[];
}

export interface ProductoResumen {
  eCodProduct: string;
  tNameProduct: string;
  bStateProduct?: boolean;
  ePriceProduct: number;
}

export interface Producto {
  fkeCodCompany:  string;
  eCodProduct:    string;
  tNameProduct:   string;
  fkeCodCategory?: string;
  ePriceProduct:  number;
  eCostProduct:   number;
  ImgProduct?:    string;
  bStateProduct?: boolean;
  tipo_producto:  "unidad" | "medida";
  ePrecioM2?:     number | null;
  eAnchoCm?:      number | null;
  eAltoCm?:       number | null;
  fkeCodMaterial?: string | null;
  fhCreateProduct?: string;
  fhUpdateProduct?: string;
  bCocina?:       boolean;
}

// Presentaciones

export interface Presentacion {
  eCodPresentacion:    string;
  fkeCodProduct:       string;
  tNombre:             string;
  ePricePresentacion:  number;
  eCostPresentacion:   number;
  eCantidadUnidades:   number;
  bStatePresentacion:  boolean;
  fhCreate?:           string;
  fhUpdate?:           string;
}

export interface GrupoExtra {
  eCodGrupoExtra:     string;
  fkeCodCompany:      string;
  tNombreGrupo:       string;
  bSeleccionMultiple: boolean;
  bRequerido:         boolean;
  eSeleccionMinima:   number | null;
  eSeleccionMaxima:   number | null;
  eOrden:             number;
  bStateGrupoExtra:   boolean;
  fhCreateGrupoExtra?: string;
  fhUpdateGrupoExtra?: string | null;
}

export interface OpcionExtra {
  eCodOpcionExtra:     string;
  fkeCodGrupoExtra:    string;
  tNombreOpcion:       string;
  ePrecioExtra:        number;
  eCantidadMaxima:     number;
  eOrden:              number;
  bStateOpcionExtra:   boolean;
  /** Insumo que esta opción representa para efectos de descuento de inventario
   *  (ej. "Avena" -> insumo "Leche de avena"). Null si esta opción no debe
   *  descontar nada por sí sola — la receta del producto decide, no la opción. */
  fkeCodInsumoMaestro: string | null;
  fhCreateOpcionExtra?: string;
  fhUpdateOpcionExtra?: string | null;
}

export interface GrupoExtraConOpciones extends GrupoExtra {
  opciones: OpcionExtra[];
}

export interface PresentacionConStock {
  eCodPresentacion:   string;
  tNombre:            string;
  ePricePresentacion: number;
  eCostPresentacion:  number;
  eCantidadUnidades:  number;
  stockDisponible:    number;
  bInfinito:          boolean;
}

export interface Inventario {
  fkeCodCompany: string;
  eCodInventory: string;
  fkeCodProduct: string;
  fkeCodPresentacion?: string | null;
  eCantIngresada: number | null;
  eCantVendida: number;
  eCantRestante: number | null;
  eStockMinimo: number | null;
  bUnlimitedInventory: boolean;
  fhCreateInventory?: string;
  fhUpdateInventory?: string;
  bStateInventory?: boolean;
}

export type EstadoStock = "disponible" | "bajo" | "agotado" | "ilimitado";

export function getEstadoStock(
  restante: number | null,
  minimo: number | null,
  ilimitado?: boolean
): EstadoStock {
  if (ilimitado || minimo === 0 || minimo === null) return "ilimitado";
  if (restante === null || restante === 0) return "agotado";
  if (restante <= minimo) return "bajo";
  return "disponible";
}

export interface ProductoConStock {
  eCodProduct:      string;
  tNameProduct:     string;
  fkeCodCategory?:  string;
  ePriceProduct:    number;
  ImgProduct?:      string;
  stockDisponible:  number;
  bInfinito?:       boolean;
  presentaciones?:  PresentacionConStock[];
  gruposExtras?:    GrupoExtraConOpciones[];
  tipo_producto?:   "unidad" | "medida";
  ePrecioM2?:       number | null;
  eAnchoCm?:        number | null;
  eAltoCm?:         number | null;
  fkeCodMaterial?:  string | null;
}

// Carrito empleado

export interface ExtraCarrito {
  fkeCodOpcionExtra: string;
  eCantidad:         number;
  ePrecioExtra:      number;
  tNombreOpcion:     string;
}

export interface ItemCarritoMenu {
  key?:            string;
  producto:        ProductoConStock;
  cantidad:        number;
  presentacion?:   PresentacionConStock;
  extrasSeleccionados?: ExtraCarrito[];
  tipo_producto?:  "unidad" | "medida";
  anchoCm?:        number;
  largoCm?:        number;
  materialNombre?: string;
  eCodMaterial?:   string;
  metrosConsumidos?: number;
  precioCalculado?:  number;
}

declare const __metodoPagoBrand: unique symbol;
export type MetodoPago = string & { readonly [__metodoPagoBrand]: never };

export interface Venta {
  fkeCodCompany: string;
  eCodVenta: string;
  fkeCodUser: string;
  empleado?: Perfil;
  eTotal: number;
  fkeMetodoPago: MetodoPago;
  metodoPagoNombre: string;
  metodoPagoIcono?: string | null;
  fhCreateVenta: string;
}

export interface DetalleVenta {
  eCodDetalle: string;
  fkeCodVenta: string;
  fkeCodProduct: string;
  fkeCodPresentacion?: string | null;
  eCantidad: number;
  ePrecioUnitario: number;
  eSubtotal: number;
  eAnchoCm?:          number | null;
  eLargoCm?:          number | null;
  fkeCodMaterial?:    string | null;
}

export interface DetalleVentaConProducto extends DetalleVenta {
  producto?:     { tNameProduct: string; ImgProduct?: string } | null;
  presentacion?: { tNombre: string } | null;
}

export interface VentasDelTurno {
  eTotalEfectivo:      number;
  eTotalTarjeta:       number;
  eTotalTransferencia: number;
  eTotalVentas:        number;
  eNumVentas:          number;
}

export type EstadoCorte = "abierto" | "pendiente" | "aprobado" | "diferencia";

export interface CorteCaja {
  eCodCorte:             string;
  fkeCodUser:            string;
  fkeCodCompany:         string;
  tNombreTurno?:         string | null;
  eFondoInicial:         number;
  eEfectivoContado?:     number | null;
  eTotalEfectivo?:       number | null;
  eTotalTarjeta?:        number | null;
  eTotalTransferencia?:  number | null;
  eTotalVentas?:         number | null;
  eEfectivoEsperado?:    number | null;
  eDiferencia?:          number | null;
  bStateCorte:           EstadoCorte;
  tNotaAdmin?:           string | null;
  fkeCodAdmin?:          string | null;
  fhInicioTurno:         string;
  fhCierreTurno?:        string | null;
  fhCreateCorte:         string;
  fhUpdateCorte:         string;
}

// ── Materiales (negocios tipo impresion) ──────────────────────────────────────

export interface Material {
  eCodMaterial:    string;
  fkeCodCompany:   string;
  tNombre:         string;
  tipo_material:   "rollo" | "hoja";
  eAnchoCm:        number | null;
  eAltoCm:         number | null;
  eMetrosLineales: number;
  eStockMinimo:    number;
  bStateMaterial:  boolean;
  fhCreateMaterial: string;
  fhUpdateMaterial?: string;
}

// ── Carrito impresión ─────────────────────────────────────────────────────────

export interface ItemCarritoImpresion {
  producto:        Producto;
  tipo_producto:   "medida" | "unidad";
  anchoCm?:        number;
  largoCm?:        number;
  materialNombre?: string;
  eCodMaterial?:   string;
  metrosConsumidos?: number;
  precioCalculado?: number;
  cantidad?:       number;
  presentacion?:   PresentacionConStock;
  precioUnitario?: number;
}

// ── Sucursales ────────────────────────────────────────────────────────────────

export interface Sucursal {
  eCodSucursal:     string;
  fkeCodCompany:    string;
  tNombre:          string;
  tDireccion?:      string | null;
  bStateSucursal:   boolean;
  fhCreateSucursal: string;
  tTokenCocina?: string | null
}

// ── Módulo: Mesas ─────────────────────────────────────────────────────────────

export interface ModuloTenant {
  eCodModulo:    string;
  fkeCodCompany: string;
  tModulo:       string;
  bStateModulo:  boolean;
  fhActivado?:   string | null;
  fhCreateModulo: string;
}

export interface Mesa {
  eCodMesa:      string;
  fkeCodCompany: string;
  fkeCodSucursal?: string | null;
  tNombre:       string;
  bStateMesa:    boolean;
  fhCreateMesa:  string;
  e_grid_col:    number;
  e_grid_row:    number;
  e_grid_w:      number;
  e_grid_h:      number;
  t_shape:       "rect" | "circle";
  fkeCodConcepto?: string | null;
}

export interface ConceptoBillar {
  eCodConcepto:  string;
  fkeCodCompany: string;
  tNombre:       string;
  eCostoHora:    number;
  bActivo:       boolean;
  fhCreate:      string;
}

export type EstadoOrdenMesa = "abierta" | "cerrada" | "cancelada";

export interface OrdenMesa {
  eCodOrden:     string;
  fkeCodMesa:    string;
  fkeCodCompany: string;
  fkeCodUser:    string;
  tEstado:       EstadoOrdenMesa;
  fhAbierta:     string;
  fhCerrada?:    string | null;
  fkeCodVenta?:  string | null;
}

export type EstadoCocina = "pendiente" | "listo" | "entregado";

export interface OrdenMesaDetalle {
  eCodDetalle:        string;
  fkeCodOrden:        string;
  fkeCodProduct:      string;
  fkeCodPresentacion?: string | null;
  eCantidad:          number;
  ePrecio:            number;
  fhAgregado:         string;
  tEstadoCocina?:     EstadoCocina | null;
}

// Vista enriquecida para el layout de mesas
export interface MesaConEstado extends Mesa {
  ordenAbierta?: OrdenMesa | null;
  /** Número de items con tEstadoCocina = 'listo' en la orden abierta */
  itemsListos?:  number;
  /** Segmento de tiempo más reciente de la orden abierta — null si fhFin
   * está definido significa que el timer está congelado ahí (ej. tras
   * "Terminar de jugar"), no que siga corriendo. */
  segmentoActivo?: { fhInicio: string; fhFin: string | null } | null;
}

// Vista enriquecida para el detalle de una orden
export interface OrdenMesaDetalleConProducto extends OrdenMesaDetalle {
  producto?:     { tNameProduct: string; ImgProduct?: string } | null;
  presentacion?: { tNombre: string } | null;
  extrasSeleccionados?: ExtraCarrito[];
}

export interface OrdenMesaConDetalle extends OrdenMesa {
  mesa?:     Mesa | null;
  empleado?: Pick<Perfil, "eCodUser" | "tNameUser"> | null;
  detalle:   OrdenMesaDetalleConProducto[];
  eTotal:    number;
}

// ── Módulo: Cocina ────────────────────────────────────────────────────────────

/** Item listo para entregar — usado por el modal de entrega en el POS */
export interface ItemListoCocina {
  eCodDetalle:         string;
  tNameProduct:        string;
  tNombrePresentacion: string | null;
  eCantidad:           number;
  fhAgregado:          string;
  extras:              { tNombre: string; eCantidad: number }[];
}

export interface InsumoMaestro {
  eCodInsumoMaestro:      string;
  fkeCodCompany:          string;
  tNombre:                string;
  tUnidadCompra:          string;  // 'kg' | 'l' | 'pza' | 'paquete'
  tUnidadReceta:          string;  // 'g' | 'ml' | 'pza'
  eFactorConversion:      number;
  bStateInsumoMaestro:    boolean;
  fhCreateInsumoMaestro:  string;
  fhUpdateInsumoMaestro?: string;
}
 
export interface InsumoStock {
  eCodInsumoStock:      string;
  fkeCodInsumoMaestro:  string;
  fkeCodSucursal:       string;
  eCantidadStock:       number;  // en unidad de receta
  eStockMinimo:         number;
  eCostoUnitario:       number;  // por unidad de compra
  version:              number;
  bStateInsumoStock:    boolean;
  fhCreateInsumoStock:  string;
  fhUpdateInsumoStock?: string;
}
 
// Vista combinada usada en la tabla y en los modales — resultado del join
// entre insumos_maestro e insumos_stock para la sucursal actual.
export interface InsumoConStock extends InsumoMaestro, InsumoStock {}

// ── Módulo: Receta de insumos ────────────────────────────────────────────────
// Pegar al final de src/types/index.ts, después del bloque de Insumos
// (reemplaza el snippet anterior si ya lo habías pegado)

export interface RecetaInsumoConDatos {
  eCodReceta:          string;
  fkeCodPresentacion:  string | null;
  fkeCodProduct:       string | null;
  /** Receta propia de una opción (ej. "Cold Foam Vainilla" con varios insumos) —
   *  independiente del mecanismo de grupo, coexisten los dos. */
  fkeCodOpcionExtra:   string | null;
  /** Insumo fijo (excluyente con fkeCodGrupoExtra). */
  fkeCodInsumoMaestro: string | null;
  /** Grupo de extras a resolver en el momento de la venta — cada opción
   *  elegida de este grupo aporta su propio insumo (excluyente con fkeCodInsumoMaestro). */
  fkeCodGrupoExtra:    string | null;
  eCantidadNecesaria:  number;
  tNombreInsumo:        string | null;  // null cuando la fila cuelga de un grupo
  tUnidadReceta:         string | null;  // null cuando la fila cuelga de un grupo
  tNombreGrupo:          string | null;  // resuelto vía join, solo cuando fkeCodGrupoExtra
}

// Fila de la vista /admin/insumos/recetas, sección Extras — una por opción
// que tiene su PROPIA receta (ej. "Cold Foam Vainilla" -> crema batida + sirope).
export interface OpcionConReceta {
  eCodOpcionExtra: string;
  tNombreOpcion:   string;
  eCodGrupoExtra:  string;
  tNombreGrupo:    string;
  cantidadInsumos: number;
}

// Fila de la vista /admin/insumos/recetas — una por presentación O por
// producto sin presentaciones (venta directa). Cuando eCodPresentacion es
// null, el renglón representa al producto completo y las acciones de receta
// deben usar eCodProduct en su lugar.
export interface PresentacionConReceta {
  eCodPresentacion: string | null;
  tNombre:          string;  // nombre de la presentación, o "—" si es venta directa
  eCodProduct:      string;
  tNameProduct:     string;  // nombre del producto dueño
  cantidadInsumos:  number;
}