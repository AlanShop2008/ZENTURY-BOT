export function parsearCuentas(texto = '') {
  if (!texto) return []

  return texto
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(linea => ({
      cuenta: linea,
      estado: 'disponible',
      fechaIngreso: new Date().toISOString()
    }))
}
