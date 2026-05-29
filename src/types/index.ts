export type Rol = "admin" | "empleado" | "sistemas";
 
export interface Perfil {
  fkeCodCompany: string | null;
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
  fkeCodCompany: string;
  eCodProduct: string;
  tNameProduct: string;
  fkeCodCategory?: string;
  ePriceProduct: number;
  eCostProduct: number;
  ImgProduct?: string;
  bStateProduct?: boolean;
  fhCreateProduct?: string;
  fhUpdateProduct?: string;
}
 
export interface Inventario {
  fkeCodCompany: string;
  eCodInventory: string;
  fkeCodProduct: string;
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
  eCodProduct: string;
  tNameProduct: string;
  fkeCodCategory?: string;
  ePriceProduct: number;
  ImgProduct?: string;
  stockDisponible: number;
  bInfinito?: boolean;
}
 
// Branded type: sigue siendo string en runtime pero TypeScript
// lo distingue de un string genérico en tiempo de compilación.
// El único punto de entrada válido es el cast explícito "as MetodoPago"
// que ocurre en PedidoPanel justo después de seleccionar el eCodPay.
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
 
// Fila pura de la tabla detalle_venta — sin joins
export interface DetalleVenta {
  eCodDetalle: string;
  fkeCodVenta: string;
  fkeCodProduct: string;
  eCantidad: number;
  ePrecioUnitario: number;
  eSubtotal: number;
}
 
// DetalleVenta con el producto anidado (resultado de join)
export interface DetalleVentaConProducto extends DetalleVenta {
  producto?: { tNameProduct: string; ImgProduct?: string } | null;
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