import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ token: string }> }

// ─── Helper ────────────────────────────────────────────────────────────────

async function validarToken(token: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sucursales')
    .select('eCodSucursal, fkeCodCompany')
    .eq('tTokenCocina', token)
    .eq('bStateSucursal', true)
    .single()

  if (error || !data) return null
  return data
}

// ─── GET — items pendientes agrupados por mesa ─────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  const sucursal = await validarToken(token)
  if (!sucursal) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1. Órdenes abiertas de esta sucursal
  const { data: ordenes, error: errorOrdenes } = await supabase
    .from('ordenes_mesa')
    .select('eCodOrden, fkeCodMesa')
    .eq('fkeCodSucursal', sucursal.eCodSucursal)
    .eq('tEstado', 'abierta')

  if (errorOrdenes) {
    return NextResponse.json({ error: errorOrdenes.message }, { status: 500 })
  }

  if (!ordenes || ordenes.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const codOrdenes = ordenes.map((o) => o.eCodOrden)
  const codMesas = [...new Set(ordenes.map((o) => o.fkeCodMesa))]

  // 2. Items pendientes de cocina + mesas en paralelo
  const [
    { data: detalles, error: errorDetalles },
    { data: mesas, error: errorMesas },
  ] = await Promise.all([
    supabase
      .from('ordenes_mesa_detalle')
      .select(
        'eCodDetalle, fkeCodOrden, fkeCodProduct, fkeCodPresentacion, eCantidad, fhAgregado'
      )
      .in('fkeCodOrden', codOrdenes)
      .eq('tEstadoCocina', 'pendiente'),
    supabase
      .from('mesas')
      .select('eCodMesa, tNombre')
      .in('eCodMesa', codMesas),
  ])

  if (errorDetalles) {
    return NextResponse.json({ error: errorDetalles.message }, { status: 500 })
  }
  if (errorMesas) {
    return NextResponse.json({ error: errorMesas.message }, { status: 500 })
  }
  if (!detalles || detalles.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 3. Productos (solo los que tienen bCocina = true)
  const codProductos = [...new Set(detalles.map((d) => d.fkeCodProduct))]
  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('eCodProduct, tNameProduct')
    .in('eCodProduct', codProductos)
    .eq('bCocina', true)

  if (errorProductos) {
    return NextResponse.json({ error: errorProductos.message }, { status: 500 })
  }

  // Filtrar detalles a solo productos con bCocina=true
  const productoCocinaSet = new Set(productos?.map((p) => p.eCodProduct) ?? [])
  const detallesCocina = detalles.filter((d) =>
    productoCocinaSet.has(d.fkeCodProduct)
  )

  if (detallesCocina.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 4. Presentaciones (solo si hay)
  const codPresentaciones = detallesCocina
    .filter((d) => d.fkeCodPresentacion)
    .map((d) => d.fkeCodPresentacion as string)

  let presentacionMap = new Map<string, string>()
  if (codPresentaciones.length > 0) {
    const { data: presentaciones } = await supabase
      .from('presentaciones')
      .select('eCodPresentacion, tNombre')
      .in('eCodPresentacion', codPresentaciones)
    presentacionMap = new Map(
      presentaciones?.map((p) => [p.eCodPresentacion, p.tNombre]) ?? []
    )
  }

  // ─── Mapas de lookup ────────────────────────────────────────────────────

  const ordenMap = new Map(ordenes.map((o) => [o.eCodOrden, o.fkeCodMesa]))
  const mesaMap = new Map(mesas?.map((m) => [m.eCodMesa, m.tNombre]) ?? [])
  const productoMap = new Map(
    productos?.map((p) => [p.eCodProduct, p.tNameProduct]) ?? []
  )

  // ─── Agrupar por mesa ───────────────────────────────────────────────────

  type ItemCocina = {
    eCodDetalle: string
    tNameProduct: string
    tNombrePresentacion: string | null
    eCantidad: number
    fhAgregado: string
  }

  type GrupoMesa = {
    eCodMesa: string
    tNombreMesa: string
    eCodOrden: string
    items: ItemCocina[]
  }

  const grouped = new Map<string, GrupoMesa>()

  for (const detalle of detallesCocina) {
    const eCodMesa = ordenMap.get(detalle.fkeCodOrden)!
    const tNombreMesa = mesaMap.get(eCodMesa) ?? 'Mesa'

    if (!grouped.has(eCodMesa)) {
      grouped.set(eCodMesa, {
        eCodMesa,
        tNombreMesa,
        eCodOrden: detalle.fkeCodOrden,
        items: [],
      })
    }

    grouped.get(eCodMesa)!.items.push({
      eCodDetalle: detalle.eCodDetalle,
      tNameProduct: productoMap.get(detalle.fkeCodProduct) ?? 'Producto',
      tNombrePresentacion: detalle.fkeCodPresentacion
        ? (presentacionMap.get(detalle.fkeCodPresentacion) ?? null)
        : null,
      eCantidad: detalle.eCantidad,
      fhAgregado: detalle.fhAgregado,
    })
  }

  return NextResponse.json({ data: Array.from(grouped.values()) })
}

// ─── PATCH — cocinero marca un item como listo ─────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { token } = await params

  const sucursal = await validarToken(token)
  if (!sucursal) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const body = await req.json()
  const { eCodDetalle } = body as { eCodDetalle?: string }

  if (!eCodDetalle) {
    return NextResponse.json({ error: 'eCodDetalle requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ordenes_mesa_detalle')
    .update({ tEstadoCocina: 'listo' })
    .eq('eCodDetalle', eCodDetalle)
    .eq('tEstadoCocina', 'pendiente') // guard: evita double-tap

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─── PUT — empleado marca un item como entregado ───────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const { token } = await params

  const sucursal = await validarToken(token)
  if (!sucursal) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const body = await req.json()
  const { eCodDetalle } = body as { eCodDetalle?: string }

  if (!eCodDetalle) {
    return NextResponse.json({ error: 'eCodDetalle requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ordenes_mesa_detalle')
    .update({ tEstadoCocina: 'entregado' })
    .eq('eCodDetalle', eCodDetalle)
    .eq('tEstadoCocina', 'listo') // guard: solo si ya está listo

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}