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

  const cuenta = cuentaTexto.trim().toLowerCase()

  for (const key in inventario) {
    const items = inventario[key]?.cuentas || []
    if (items.some(c => String(c).trim().toLowerCase() === cuenta)) return true
  }

  if (vendidas.some(v => String(v.cuenta).trim().toLowerCase() === cuenta)) return true

  return false
}

export function agregarStock(id, plataforma, tipo, precio, cuentas = []) {
  const inventario = obtenerInventario(id)
  const key = keyProducto(plataforma, tipo)

  if (!inventario[key]) {
    inventario[key] = {
      plataforma: normalizar(plataforma),
      tipo: normalizar(tipo),
      precio: Number(precio),
      cuentas: []
    }
  }

  inventario[key].precio = Number(precio)

  let agregadas = 0
  let duplicadas = 0

  for (const cuenta of cuentas) {
    const limpia = String(cuenta).trim()
    if (!limpia) continue

    if (cuentaExiste(id, limpia)) {
      duplicadas++
      continue
    }

    inventario[key].cuentas.push(limpia)
    agregadas++
  }

  guardarInventario(id, inventario)

  return {
    agregadas,
    duplicadas,
    total: inventario[key].cuentas.length,
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
      const stock = p.cuentas?.length || 0
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

  if (!producto) {
    return { ok: false, motivo: 'producto_no_existe' }
  }

  if (!producto.cuentas || producto.cuentas.length <= 0) {
    return { ok: false, motivo: 'sin_stock' }
  }

  const precio = Number(producto.precio || 0)
  const saldoActual = Number(saldos[comprador] || 0)

  if (saldoActual < precio) {
    return {
      ok: false,
      motivo: 'saldo_insuficiente',
      saldo: saldoActual,
      precio
    }
  }

  const cuenta = producto.cuentas.shift()

  saldos[comprador] = saldoActual - precio

  const venta = {
    id: Date.now(),
    comprador,
    plataforma: producto.plataforma,
    tipo: producto.tipo,
    precio,
    cuenta,
    fecha: new Date().toISOString(),
    grupo: id
  }

  vendidas.push(venta)
  ventas.push(venta)

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

  return {
    anterior: actual,
    agregado: Number(cantidad),
    actual: saldos[usuario]
  }
}

export function restarSaldo(id, usuario, cantidad) {
  const saldos = obtenerSaldos(id)
  const actual = Number(saldos[usuario] || 0)

  saldos[usuario] = Math.max(0, actual - Number(cantidad))

  guardarSaldos(id, saldos)

  return {
    anterior: actual,
    restado: Number(cantidad),
    actual: saldos[usuario]
  }
}

export function verSaldo(id, usuario) {
  const saldos = obtenerSaldos(id)
  return Number(saldos[usuario] || 0)
}

export function agregarAsistente(id, usuario) {
  const asistentes = obtenerAsistentes(id)

  if (!asistentes.includes(usuario)) {
    asistentes.push(usuario)
  }

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
