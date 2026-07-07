import path from 'path'
import { crearGrupo, rutaGrupo } from './grupos.js'
import { leerJSON, guardarJSON } from './database.js'

function normalizar(texto = '') {
  return texto.toLowerCase().trim()
}

function ruta(id, archivo) {
  crearGrupo(id)
  return path.join(rutaGrupo(id), archivo)
}

function keyProducto(plataforma, tipo) {
  return `${normalizar(plataforma)}_${normalizar(tipo)}`
}

function generarIdCuenta(plataforma, total) {
  const prefijo = normalizar(plataforma).slice(0, 3).toUpperCase()
  return `${prefijo}-${String(total + 1).padStart(6, '0')}`
}

function generarIdVenta(total) {
  return `V-${String(total + 1).padStart(6, '0')}`
}

export function obtenerInventario(id) {
  return leerJSON(ruta(id, 'inventario.json'), {})
}

export function guardarInventario(id, data) {
  return guardarJSON(ruta(id, 'inventario.json'), data)
}

export function obtenerVendidas(id) {
  return leerJSON(ruta(id, 'vendidas.json'), [])
}

export function guardarVendidas(id, data) {
  return guardarJSON(ruta(id, 'vendidas.json'), data)
}

export function obtenerVentas(id) {
  return leerJSON(ruta(id, 'ventas.json'), [])
}

export function guardarVentas(id, data) {
  return guardarJSON(ruta(id, 'ventas.json'), data)
}

export function obtenerSaldos(id) {
  return leerJSON(ruta(id, 'saldos.json'), {})
}

export function guardarSaldos(id, data) {
  return guardarJSON(ruta(id, 'saldos.json'), data)
}

export function obtenerAsistentes(id) {
  return leerJSON(ruta(id, 'asistentes.json'), [])
}

export function guardarAsistentes(id, data) {
  return guardarJSON(ruta(id, 'asistentes.json'), data)
}

export function cuentaExiste(id, cuentaTexto) {
  const inventario = obtenerInventario(id)
  const vendidas = obtenerVendidas(id)
  const cuenta = String(cuentaTexto).trim().toLowerCase()

  for (const key in inventario) {
    const stock = inventario[key]?.stock || []
    if (stock.some(item => String(item.cuenta).trim().toLowerCase() === cuenta)) return true
  }

  if (vendidas.some(v => String(v.cuenta).trim().toLowerCase() === cuenta)) return true

  return false
}

export function agregarStock(id, plataforma, tipo, precio, cuentas = [], agregadoPor = '') {
  const inventario = obtenerInventario(id)
  const vendidas = obtenerVendidas(id)
  const key = keyProducto(plataforma, tipo)

  if (!inventario[key]) {
    inventario[key] = {
      plataforma: normalizar(plataforma),
      tipo: normalizar(tipo),
      precio: Number(precio),
      stock: []
    }
  }

  inventario[key].precio = Number(precio)

  let agregadas = 0
  let duplicadas = 0

  const totalExistente =
    Object.values(inventario).reduce((acc, p) => acc + (p.stock?.length || 0), 0) +
    vendidas.length

  let contador = totalExistente

  for (const cuenta of cuentas) {
    const limpia = String(cuenta).trim()
    if (!limpia) continue

    if (cuentaExiste(id, limpia)) {
      duplicadas++
      continue
    }

    inventario[key].stock.push({
      id: generarIdCuenta(plataforma, contador),
      cuenta: limpia,
      fecha: new Date().toISOString(),
      agregadoPor,
      estado: 'disponible'
    })

    contador++
    agregadas++
  }

  guardarInventario(id, inventario)

  return {
    agregadas,
    duplicadas,
    total: inventario[key].stock.filter(x => x.estado === 'disponible').length,
    producto: inventario[key]
  }
}

export function obtenerProducto(id, plataforma, tipo) {
  const inventario = obtenerInventario(id)
  return inventario[keyProducto(plataforma, tipo)] || null
}

export function editarPrecio(id, plataforma, tipo, precio) {
  const inventario = obtenerInventario(id)
  const key = keyProducto(plataforma, tipo)

  if (!inventario[key]) return null

  inventario[key].precio = Number(precio)
  guardarInventario(id, inventario)

  return inventario[key]
}

export function generarTienda(id) {
  const inventario = obtenerInventario(id)
  const productos = Object.values(inventario)

  if (!productos.length) {
    return '🛒 *TIENDA STREAMING*\n\nNo hay productos cargados todavía.'
  }

  const grupos = {}

  for (const p of productos) {
    if (!grupos[p.plataforma]) grupos[p.plataforma] = []
    grupos[p.plataforma].push(p)
  }

  let text = `🛒 *TIENDA STREAMING*

━━━━━━━━━━━━━━━━━━

`

  for (const plataforma in grupos) {
    text += `🎬 *${capitalizar(plataforma)}*\n`

    for (const p of grupos[plataforma]) {
      const stock = (p.stock || []).filter(x => x.estado === 'disponible').length
      const estado = stock > 0 ? `📦${stock}` : '❌'
      text += `• ${capitalizar(p.tipo)} .......... $${p.precio} | ${estado}\n`
    }

    text += '\n'
  }

  text += `━━━━━━━━━━━━━━━━━━

💳 *Comprar:*
.comprar netflix perfil`

  return text
}

export function comprarProducto(id, comprador, plataforma, tipo) {
  const inventario = obtenerInventario(id)
  const vendidas = obtenerVendidas(id)
  const ventas = obtenerVentas(id)
  const saldos = obtenerSaldos(id)

  const key = keyProducto(plataforma, tipo)
  const producto = inventario[key]

  if (!producto) return { ok: false, motivo: 'producto_no_existe' }

  const disponible = producto.stock?.find(item => item.estado === 'disponible')

  if (!disponible) return { ok: false, motivo: 'sin_stock' }

  const precio = Number(producto.precio || 0)
  const saldoActual = Number(saldos[comprador] || 0)

  if (saldoActual < precio) {
    return { ok: false, motivo: 'saldo_insuficiente', saldo: saldoActual, precio }
  }

  disponible.estado = 'vendida'
  disponible.vendidaA = comprador
  disponible.fechaVenta = new Date().toISOString()

  saldos[comprador] = saldoActual - precio

  const venta = {
    idVenta: generarIdVenta(ventas.length),
    idCuenta: disponible.id,
    comprador,
    plataforma: producto.plataforma,
    tipo: producto.tipo,
    precio,
    cuenta: disponible.cuenta,
    fecha: new Date().toISOString(),
    garantiaHasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    grupo: id
  }

  vendidas.push(venta)
  ventas.push(venta)

  producto.stock = producto.stock.filter(item => item.id !== disponible.id)

  guardarInventario(id, inventario)
  guardarVendidas(id, vendidas)
  guardarVentas(id, ventas)
  guardarSaldos(id, saldos)

  return {
    ok: true,
    venta,
    saldoRestante: saldos[comprador]
  }
}

export function registrarSaldo(id, usuario, cantidad) {
  const saldos = obtenerSaldos(id)
  const actual = Number(saldos[usuario] || 0)

  saldos[usuario] = actual + Number(cantidad)
  guardarSaldos(id, saldos)

  return { anterior: actual, agregado: Number(cantidad), actual: saldos[usuario] }
}

export function restarSaldo(id, usuario, cantidad) {
  const saldos = obtenerSaldos(id)
  const actual = Number(saldos[usuario] || 0)

  saldos[usuario] = Math.max(0, actual - Number(cantidad))
  guardarSaldos(id, saldos)

  return { anterior: actual, restado: Number(cantidad), actual: saldos[usuario] }
}

export function verSaldo(id, usuario) {
  const saldos = obtenerSaldos(id)
  return Number(saldos[usuario] || 0)
}

export function agregarAsistente(id, usuario) {
  const asistentes = obtenerAsistentes(id)

  if (!asistentes.includes(usuario)) asistentes.push(usuario)

  guardarAsistentes(id, asistentes)
  return asistentes
}

export function eliminarAsistente(id, usuario) {
  let asistentes = obtenerAsistentes(id)
  asistentes = asistentes.filter(a => a !== usuario)

  guardarAsistentes(id, asistentes)
  return asistentes
}

export function capitalizar(txt = '') {
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}
                            
