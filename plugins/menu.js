
import fs from 'fs'

const handler = async (m, { conn }) => {
  const text = `╭━━━〔 🤖 *ZENTURY BOT* 〕━━━╮
┃  Desarrollado por *ALAN SHOP*
╰━━━━━━━━━━━━━━━━━━━━━━╯

🛒 *TIENDA STREAMING*
┃ .tienda
┃ .comprar netflix perfil
┃ .versaldo
┃ .miscuentas
┃ .historial

📦 *STOCK / STAFF*
┃ .addstock netflix perfil 35
┃ .entregar @usuario netflix perfil
┃ .editarprecio netflix perfil 40
┃ .cuentasvendidas
┃ .verclientes
┃ .registrartodos

🎵 *MÚSICA*
┃ .play canción o artista

👥 *GRUPO*
┃ .n mensaje
┃ .kick @usuario
┃ .mute 30m
┃ .unmute
┃ .sorteo Netflix
┃ .finalizar

👑 *OWNER*
┃ .owner
┃ .activar 30d
┃ .desactivar
┃ .estado
┃ .grupos
┃ .exit ID
┃ .enviaraviso ID mensaje

╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🔒 Antilink global activo
┃ ⚡ Zentury Bot v1.0
╰━━━━━━━━━━━━━━━━━━━━━━╯`

  const img = './storage/img/catalogo.png'
  if (fs.existsSync(img)) {
    await conn.sendMessage(m.chat, { image: fs.readFileSync(img), caption: text }, { quoted: m })
  } else {
    await m.reply(text)
  }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|help)$/i
export default handler
