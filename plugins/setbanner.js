import fs from 'fs'

const OWNER = '5217715555998'
const handler = async (m, { conn }) => {
  const sender = String(m.sender || '').replace(/\D/g, '')
  if (!sender.includes(OWNER)) return m.reply('❌ Solo el owner puede cambiar el banner.')
  const q = m.quoted || m
  const mime = (q.msg || q).mimetype || ''
  if (!/image/.test(mime)) return m.reply('Responde a una imagen con .setbanner')
  const buffer = await q.download()
  fs.mkdirSync('./storage/img', { recursive: true })
  if (fs.existsSync('./storage/img/catalogo.png')) fs.unlinkSync('./storage/img/catalogo.png')
  fs.writeFileSync('./storage/img/catalogo.png', buffer)
  await m.reply('✅ Banner actualizado. Ahora .menu usará la nueva imagen.')
}
handler.help = ['setbanner']
handler.tags = ['owner']
handler.command = /^setbanner$/i
export default handler
