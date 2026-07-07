import fs from 'fs'
import path from 'path'

const ROOT = './database'
const GROUPS_DIR = path.join(ROOT, 'grupos')
const GROUPS_FILE = path.join(ROOT, 'grupos.json')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

export function groupPath(groupId) {
  return path.join(GROUPS_DIR, groupId)
}

export function ensureGroup(groupId, name = 'Grupo sin nombre') {
  ensureDir(ROOT)
  ensureDir(GROUPS_DIR)
  const dir = groupPath(groupId)
  ensureDir(dir)

  const defaults = {
    'config.json': {
      id: groupId,
      nombre: name,
      activo: false,
      vence: null,
      creado: new Date().toISOString(),
      tiendaAbierta: true,
      antilink: true,
    },
    'inventario.json': {},
    'vendidas.json': [],
    'ventas.json': [],
    'clientes.json': {},
    'saldos.json': {},
    'asistentes.json': [],
    'comandos.json': {},
    'sorteos.json': {},
    'logs.json': [],
  }

  for (const [file, data] of Object.entries(defaults)) {
    const full = path.join(dir, file)
    if (!fs.existsSync(full)) writeJson(full, data)
  }

  const grupos = readJson(GROUPS_FILE, [])
  if (!grupos.find(g => g.id === groupId)) {
    grupos.push({ id: groupId, nombre: name, activo: false, vence: null, creado: new Date().toISOString() })
    writeJson(GROUPS_FILE, grupos)
  }

  return dir
}

export function getGroupConfig(groupId) {
  ensureGroup(groupId)
  return readJson(path.join(groupPath(groupId), 'config.json'), {})
}

export function setGroupConfig(groupId, patch = {}) {
  const current = getGroupConfig(groupId)
  const next = { ...current, ...patch }
  writeJson(path.join(groupPath(groupId), 'config.json'), next)

  const grupos = readJson(GROUPS_FILE, [])
  const i = grupos.findIndex(g => g.id === groupId)
  if (i >= 0) grupos[i] = { ...grupos[i], nombre: next.nombre, activo: next.activo, vence: next.vence }
  else grupos.push({ id: groupId, nombre: next.nombre, activo: next.activo, vence: next.vence })
  writeJson(GROUPS_FILE, grupos)
  return next
}

export function parseDuration(input = '30d') {
  const m = String(input).trim().toLowerCase().match(/^(\d+)(s|m|h|d)$/)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]
  const ms = unit === 's' ? n * 1000 : unit === 'm' ? n * 60000 : unit === 'h' ? n * 3600000 : n * 86400000
  return { n, unit, ms }
}

export function activateGroup(groupId, duration = '30d') {
  const parsed = parseDuration(duration)
  if (!parsed) throw new Error('Duración inválida. Usa 30d, 1h, 20m, etc.')
  const vence = new Date(Date.now() + parsed.ms).toISOString()
  return setGroupConfig(groupId, { activo: true, vence })
}

export function deactivateGroup(groupId) {
  return setGroupConfig(groupId, { activo: false, vence: null })
}

export function isGroupActive(groupId) {
  const cfg = getGroupConfig(groupId)
  if (!cfg.activo || !cfg.vence) return false
  if (new Date(cfg.vence).getTime() <= Date.now()) {
    setGroupConfig(groupId, { activo: false })
    return false
  }
  return true
}

export function listGroups() {
  return readJson(GROUPS_FILE, [])
}

export function logGroup(groupId, text) {
  ensureGroup(groupId)
  const file = path.join(groupPath(groupId), 'logs.json')
  const logs = readJson(file, [])
  logs.push({ fecha: new Date().toISOString(), texto: text })
  writeJson(file, logs.slice(-1000))
}
