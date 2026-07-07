export function importarDesdeTexto(texto = '') {
  if (!texto) return []

  return texto
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(x => x.length > 0)
}

export function eliminarDuplicados(lista = []) {
  return [...new Set(lista)]
}

export function validarCuenta(cuenta = '') {
  cuenta = cuenta.trim()

  if (!cuenta) return false

  if (cuenta.length < 5) return false

  return true
}

export function prepararImportacion(texto = '') {
  let cuentas = importarDesdeTexto(texto)

  cuentas = cuentas.filter(validarCuenta)

  cuentas = eliminarDuplicados(cuentas)

  return cuentas
}
