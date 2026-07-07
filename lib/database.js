import fs from 'fs'
import path from 'path'

export function asegurarCarpeta(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function existeArchivo(ruta) {
  return fs.existsSync(ruta)
}

export function leerJSON(ruta, valorDefault = {}) {
  try {
    const dir = path.dirname(ruta)
    asegurarCarpeta(dir)

    if (!fs.existsSync(ruta)) {
      guardarJSON(ruta, valorDefault)
      return valorDefault
    }

    const data = fs.readFileSync(ruta, 'utf8')
    if (!data.trim()) return valorDefault

    return JSON.parse(data)
  } catch (e) {
    console.error(`Error leyendo JSON: ${ruta}`, e)
    return valorDefault
  }
}

export function guardarJSON(ruta, data = {}) {
  try {
    const dir = path.dirname(ruta)
    asegurarCarpeta(dir)

    fs.writeFileSync(ruta, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error(`Error guardando JSON: ${ruta}`, e)
    return false
  }
}

export function crearArchivoJSON(ruta, valorDefault = {}) {
  try {
    const dir = path.dirname(ruta)
    asegurarCarpeta(dir)

    if (!fs.existsSync(ruta)) {
      guardarJSON(ruta, valorDefault)
    }

    return leerJSON(ruta, valorDefault)
  } catch (e) {
    console.error(`Error creando archivo JSON: ${ruta}`, e)
    return valorDefault
  }
}

export function eliminarArchivo(ruta) {
  try {
    if (fs.existsSync(ruta)) {
      fs.unlinkSync(ruta)
      return true
    }
    return false
  } catch (e) {
    console.error(`Error eliminando archivo: ${ruta}`, e)
    return false
  }
}

export function listarCarpetas(ruta) {
  try {
    asegurarCarpeta(ruta)

    return fs.readdirSync(ruta).filter(file => {
      const full = path.join(ruta, file)
      return fs.statSync(full).isDirectory()
    })
  } catch (e) {
    console.error(`Error listando carpetas: ${ruta}`, e)
    return []
  }
}

export function listarArchivos(ruta) {
  try {
    asegurarCarpeta(ruta)

    return fs.readdirSync(ruta).filter(file => {
      const full = path.join(ruta, file)
      return fs.statSync(full).isFile()
    })
  } catch (e) {
    console.error(`Error listando archivos: ${ruta}`, e)
    return []
  }
}
