export default async function print(m, conn = {}) {
  try {
    const chat = m.chat || ''
    const sender = m.sender || ''
    const text = m.text || ''
    const name = m.name || ''

    console.log(`📩 ${name} | ${sender} | ${chat} | ${text}`)
  } catch {
    console.log('Mensaje recibido')
  }
}
