export type Rol = "admin" | "empleado";

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  icono?: string;
}

export interface Producto {
  id: number;
  nombre: string;
  categoria_id: number;
  categoria?: Categoria;
  precio: number;
  costo: number;
  imagen_url?: string;
  activo: boolean;
}

export interface Existencia {
  id: number;
  producto_id: number;
  producto?: Producto;
  cantidad: number;
  stock_minimo: number;
  actualizado_at: string;
}

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

export interface Venta {
  id: number;
  empleado_id: string;
  empleado?: Perfil;
  total: number;
  metodo_pago: MetodoPago;
  created_at: string;
}

export interface DetalleVenta {
  id: number;
  venta_id: number;
  producto_id: number;
  producto?: Producto;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ItemCarrito {
  producto: Producto & { cantidad_disponible: number };
  cantidad: number;
  subtotal: number;
}

export type EstadoStock = "disponible" | "bajo" | "agotado";

export function getEstadoStock(cantidad: number, minimo: number): EstadoStock {
  if (cantidad === 0) return "agotado";
  if (cantidad <= minimo) return "bajo";
  return "disponible";
}