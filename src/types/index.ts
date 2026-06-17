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
  // Dimensiones para productos tipo "unidad" en negocios de impresión
  eAnchoCm?:      number | null;
  eAltoCm?:       number | null;
  fkeCodMaterial?: string | null;
  fhCreateProduct?: string;
  fhUpdateProduct?: string;
}

// Presentaciones

export interface Presentacion {
  eCodPresentacion:    string;
  fkeCodProduct:       string;
  tNombre:             string;
  ePricePresentacion:  number;
  eCostPresentacion:   number;
  eCantidadUnidades:   number;   // cuántas piezas físicas representa (ej. 12 para "docena")
  bStatePresentacion:  boolean;
  fhCreate?:           string;
  fhUpdate?:           string;
}

export interface PresentacionConStock {
  eCodPresentacion:   string;
  tNombre:            string;
  ePricePresentacion: number;
  eCostPresentacion:  number;
  eCantidadUnidades:  number;    // cuántas piezas físicas representa
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
  tipo_producto?:   "unidad" | "medida";
  ePrecioM2?:       number | null;
  // Dimensiones para productos tipo "unidad" con consumo de hojas
  eAnchoCm?:        number | null;
  eAltoCm?:         number | null;
  fkeCodMaterial?:  string | null;
}

// Carrito empleado

/**
 * Item en el carrito. Exportado desde types para que PedidoPanel
 * pueda importarlo sin depender de MenuClient.
 */
export interface ItemCarritoMenu {
  key?:            string;
  producto:        ProductoConStock;
  cantidad:        number;
  presentacion?:   PresentacionConStock;
  // Campos para productos por medida
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
  presentacion?: { tNombre: string } | null;   // ← agregar esta línea
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
  eAnchoCm:        number | null;  // ancho del rollo (cm) o ancho de la hoja (cm)
  eAltoCm:         number | null;  // alto de la hoja (cm); null para rollos
  eMetrosLineales: number;         // metros para rollos; cantidad de hojas para hojas
  eStockMinimo:    number;
  bStateMaterial:  boolean;
  fhCreateMaterial: string;
  fhUpdateMaterial?: string;
}

// ── Carrito impresión ─────────────────────────────────────────────────────────

export interface ItemCarritoImpresion {
  producto:        Producto;
  tipo_producto:   "medida" | "unidad";
  // Para productos por medida
  anchoCm?:        number;
  largoCm?:        number;
  materialNombre?: string;
  eCodMaterial?:   string;
  metrosConsumidos?: number;
  precioCalculado?: number;
  // Para productos por unidad
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
  tNombre:       string;
  bStateMesa:    boolean;
  fhCreateMesa:  string;
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

export interface OrdenMesaDetalle {
  eCodDetalle:        string;
  fkeCodOrden:        string;
  fkeCodProduct:      string;
  fkeCodPresentacion?: string | null;
  eCantidad:          number;
  ePrecio:            number;
  fhAgregado:         string;
}

// Vista enriquecida para el layout de mesas
export interface MesaConEstado extends Mesa {
  ordenAbierta?: OrdenMesa | null;
}

// Vista enriquecida para el detalle de una orden
export interface OrdenMesaDetalleConProducto extends OrdenMesaDetalle {
  producto?:     { tNameProduct: string; ImgProduct?: string } | null;
  presentacion?: { tNombre: string } | null;
}

export interface OrdenMesaConDetalle extends OrdenMesa {
  mesa?:     Mesa | null;
  empleado?: Pick<Perfil, "eCodUser" | "tNameUser"> | null;
  detalle:   OrdenMesaDetalleConProducto[];
  eTotal:    number; // suma calculada del detalle
}