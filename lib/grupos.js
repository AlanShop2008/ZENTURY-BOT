import path from 'path'
import { asegurarCarpeta, leerJSON, guardarJSON, crearArchivoJSON } from './database.js'

const BASE = './database'
const GRUPOS_DIR = path.join(BASE, 'grupos')
const GRUPOS_GLOBAL = path.join(BASE, 'grupos.json')

export function rutaGrupo(id) {
  return path.join(GRUPOS_DIR, id)
}

export function crearGrupo(id, nombre = 'Grupo sin nombre') {
  asegurarCarpeta(BASE)
  asegurarCarpeta(GRUPOS_DIR)

  const dir = rutaGrupo(id)
  asegurarCarpeta(dir)

  crearArchivoJSON(path.join(dir, 'config.json'), {
    id,
    nombre,
    activo: false,
    creado: new Date().toISOString(),
    activado: null,
    vence: null
  })

  crearArchivoJSON(path.join(dir, 'inventario.json'), {})
  crearArchivoJSON(path.join(dir, 'vendidas.json'), [])
  crearArchivoJSON(path.join(dir, 'ventas.json'), [])
  crearArchivoJSON(path.join(dir, 'clientes.json'), {})
  crearArchivoJSON(path.join(dir, 'saldos.json'), {})
  crearArchivoJSON(path.join(dir, 'asistentes.json'), [])
  crearArchivoJSON(path.join(dir, 'comandos.json'), {})
  crearArchivoJSON(path.join(dir, 'sorteos.json'), {})
  crearArchivoJSON(path.join(dir, 'logs.json'), [])

  registrarGrupoGlobal(id, nombre)

  return dir
}

export function registrarGrupoGlobal(id, nombre = 'Grupo sin nombre') {
  const grupos = leerJSON(GRUPOS_GLOBAL, [])

  const existe = grupos.find(g => g.id === id)

  if (!existe) {
    grupos.push({
      id,
      nombre,
      activo: false,
      creado: new Date().toISOString(),
      activado: null,
      vence: null
    })
  } else {
    existe.nombre = nombre || existe.nombre
  }

  guardarJSON(GRUPOS_GLOBAL, grupos)
  return grupos
}

export function obtenerConfigGrupo(id) {
  crearGrupo(id)
  return leerJSON(path.join(rutaGrupo(id), 'config.json'), {})
}

export function guardarConfigGrupo(id, config) {
  crearGrupo(id)
  guardarJSON(path.join(rutaGrupo(id), 'config.json'), config)

  const grupos = leerJSON(GRUPOS_GLOBAL, [])
  const index = grupos.findIndex(g => g.id === id)

  if (index !== -1) {
    grupos[index] = {
      ...grupos[index],
      nombre: config.nombre || grupos[index].nombre,
      activo: config.activo,
      activado: config.activado,
      vence: config.vence
    }
  }

  guardarJSON(GRUPOS_GLOBAL, grupos)
  return config
}

export function activarGrupo(id, dias = 30, nombre = 'Grupo sin nombre') {
  crearGrupo(id, nombre)

  const ahora = new Date()
  const vence = new Date(ahora.getTime() + Number(dias) * 24 * 60 * 60 * 1000)

  const config = obtenerConfigGrupo(id)

  config.id = id
  config.nombre = nombre || config.nombre
  config.activo = true
  config.activado = ahora.toISOString()
  config.vence = vence.toISOString()

  guardarConfigGrupo(id, config)

  return config
}

export function desactivarGrupo(id) {
  crearGrupo(id)

  const config = obtenerConfigGrupo(id)

  config.activo = false
  config.vence = null

  guardarConfigGrupo(id, config)

  return config
}

export function grupoActivo(id) {
  const config = obtenerConfigGrupo(id)

  if (!config.activo) return false
  if (!config.vence) return false

  const ahora = Date.now()
  const vence = new Date(config.vence).getTime()

  if (vence <= ahora) {
    desactivarGrupo(id)
    return false
  }

  return true
}

export function diasRestantes(id) {
  const config = obtenerConfigGrupo(id)

  if (!config.vence) return 0

  const ahora = Date.now()
  const vence = new Date(config.vence).getTime()
  const diff = vence - ahora

  if (diff <= 0) return 0

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function listarGrupos() {
  return leerJSON(GRUPOS_GLOBAL, [])
}

export function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha'

  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
