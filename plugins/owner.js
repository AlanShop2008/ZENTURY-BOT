import fs from 'fs'
import path from 'path'
import {
  activarGrupo,
  desactivarGrupo,
  obtenerConfigGrupo,
  diasRestantes,
  listarGrupos,
  formatearFecha
} from '../lib/grupos.js'

const OWNER_NUMBER = '5217715555998'
const OWNER_JID = `${OWNER_NUMBER}@s.whatsapp.net`

function soloOwner(m) {
  const sender = m.sender.replace(/[^0-9]/g, '')
  return sender === OWNER_NUMBER
}

function parseDias(txt = '') {
  const match = txt.match(/(\d+)\s*d/i)
  return match ? Number(match[1]) : 30
}

const handler = async (m, { conn, command, text }) => {
  if (command === 'owner') {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:ALAN SHOP
ORG:ZENTURY BOT;
TEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER}:+${OWNER_NUMBER}
END:VCARD`

    await conn.sendMessage(m.chat, {
      contacts: {
        displayName: 'ALAN SHOP',
        contacts: [{ vcard }]
      }
    }, { quoted: m })

    return
  }

  if (!soloOwner(m)) {
    return m.reply('❌ Este comando solo puede usarlo el owner.')
  }

  if (command === 'activar') {
    let args = text.trim().split(/\s+/)
    let groupId = m.isGroup ? m.chat : args[0]
    let dias = m.isGroup ? parseDias(text) : parseDias(args.slice(1).join(' '))

    if (!groupId || !groupId.endsWith('@g.us')) {
      return m.reply('Uso:\n.activar 30d\n.activar ID 30d')
    }

    let nombre = 'Grupo sin nombre'
    try {
      const meta = await conn.groupMetadata(groupId)
      nombre = meta.subject || nombre
    } catch {}

    const config = activarGrupo(groupId, dias, nombre)

    const msgGrupo = `🤖 *ZENTURY BOT ACTIVADO*

Hola, grupo 👋

✅ Este grupo ya está activado.
⏳ Duración: ${dias} días
📅 Vence: ${formatearFecha(config.vence)}

Ya pueden usar mis funciones:

🛒 Tienda
🎵 Música
👥 Administración
🎁 Sorteos

Escribe:
.menu`

    await conn.sendMessage(groupId, { text: msgGrupo }).catch(() => {})

    return m.reply(`✅ Grupo activado correctamente.

👥 ${nombre}
🆔 ${groupId}
⏳ ${dias} días
📅 Vence: ${formatearFecha(config.vence)}`)
  }

  if (command === 'desactivar') {
    let groupId = text.trim() || m.chat

    if (!groupId.endsWith('@g.us')) {
      return m.reply('Uso:\n.desactivar\n.desactivar ID')
    }

    desactivarGrupo(groupId)

    const msgGrupo = `🔴 *ZENTURY BOT DESACTIVADO*

Este grupo ya no cuenta con activación vigente.

Para contratar o renovar el servicio usa:

.owner`

    await conn.sendMessage(groupId, { text: msgGrupo }).catch(() => {})

    return m.reply(`🔴 Grupo desactivado correctamente.

🆔 ${groupId}`)
  }

  if (command === 'estado') {
    let groupId = text.trim() || m.chat

    if (!groupId.endsWith('@g.us')) {
      return m.reply('Uso:\n.estado\n.estado ID')
    }

    const config = obtenerConfigGrupo(groupId)
    const dias = diasRestantes(groupId)

    return m.reply(`🤖 *ESTADO DEL BOT*

👥 Grupo:
${config.nombre || 'Sin nombre'}

🆔 ID:
${groupId}

Estado:
${config.activo && dias > 0 ? '🟢 Activo' : '🔴 Desactivado'}

⏳ Días restantes:
${dias}

📅 Activado:
${formatearFecha(config.activado)}

📅 Vence:
${formatearFecha(config.vence)}`)
  }

  if (command === 'grupos') {
    const grupos = listarGrupos()

    if (!grupos.length) {
      return m.reply('📋 No hay grupos registrados todavía.')
    }

    let activos = 0
    let inactivos = 0

    let txt = `📋 *ZENTURY BOT*

Grupos conectados: ${grupos.length}

`

    grupos.forEach((g, i) => {
      const dias = diasRestantes(g.id)
      const activo = g.activo && dias > 0

      if (activo) activos++
      else inactivos++

      txt += `${i + 1}️⃣ ${g.nombre || 'Grupo sin nombre'}
🆔 ${g.id}
${activo ? `🟢 Activo | ⏳ ${dias} días` : '🔴 Desactivado'}

`
    })

    txt += `━━━━━━━━━━━━━━
Activos: ${activos}
Desactivados: ${inactivos}`

    return m.reply(txt)
  }

  if (command === 'exit') {
    const groupId = text.trim()

    if (!groupId.endsWith('@g.us')) {
      return m.reply('Uso:\n.exit ID')
    }

    await conn.sendMessage(groupId, {
      text: '👋 Zentury Bot saldrá del grupo.'
    }).catch(() => {})

    await conn.groupLeave(groupId)

    return m.reply(`✅ Salí del grupo:

${groupId}`)
  }

  if (command === 'enviaraviso') {
    const [groupId, ...msg] = text.trim().split(/\s+/)

    if (!groupId || !groupId.endsWith('@g.us') || !msg.length) {
      return m.reply('Uso:\n.enviaraviso ID mensaje')
    }

    const aviso = msg.join(' ')

    await conn.sendMessage(groupId, {
      text: `📢 *AVISO*

${aviso}`
    })

    return m.reply('✅ Aviso enviado correctamente.')
  }

  if (command === 'setbanner') {
    const q = m.quoted || m
    const mime = (q.msg || q).mimetype || ''

    if (!/image/.test(mime)) {
      return m.reply('Responde a una imagen con:\n.setbanner')
    }

    const dir = './storage/img'
    const file = path.join(dir, 'catalogo.png')

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const buffer = await q.download()
    if (fs.existsSync(file)) fs.unlinkSync(file)

    fs.writeFileSync(file, buffer)

    return m.reply('✅ Banner actualizado correctamente.\n\nAhora .menu usará la nueva imagen.')
  }

  if (command === 'autoadmin') {
    if (!m.isGroup) return m.reply('Este comando solo funciona en grupos.')

    const groupMetadata = await conn.groupMetadata(m.chat)
    const botId = conn.user.jid
    const bot = groupMetadata.participants.find(p => p.id === botId)

    if (!bot?.admin) {
      return m.reply('❌ Necesito ser administrador para dar admin.')
    }

    await conn.groupParticipantsUpdate(m.chat, [m.sender], 'promote')
    return m.reply('👑 Owner promovido a administrador.')
  }
}

handler.help = [
  'owner',
  'activar',
  'desactivar',
  'estado',
  'grupos',
  'exit',
  'enviaraviso',
  'setbanner',
  'autoadmin'
]

handler.tags = ['owner']
handler.command = /^(owner|activar|desactivar|estado|grupos|exit|enviaraviso|setbanner|autoadmin)$/i

export default handler
