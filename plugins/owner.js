import { activateGroup, deactivateGroup, listGroups } from '../lib/zenturyDB.js'

const OWNER = '5217715555998'

function isOwner(m) {
  return String(m.sender || '').replace(/\D/g, '').includes(OWNER)
}

function daysLeft(iso) {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

const handler = async (m, { conn, text, command }) => {
  if (command === 'owner') {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:ALAN SHOP\nTEL;type=CELL;type=VOICE;waid=${OWNER}:+52 771 555 5998\nEND:VCARD`
    return conn.sendMessage(m.chat, { contacts: { displayName: 'ALAN SHOP', contacts: [{ vcard }] } }, { quoted: m })
  }

  if (!isOwner(m)) return m.reply('❌ Solo el owner puede usar este comando.')

  if (command === 'activar') {
    const args = (text || '').trim().split(/\s+/).filter(Boolean)
    let groupId = m.isGroup ? m.chat : args[0]
    let dur = m.isGroup ? args[0] : args[1]
    if (!groupId || !dur) return m.reply('Uso: .activar 30d  |  .activar ID 30d')
    const cfg = activateGroup(groupId, dur)
    const msg = `🤖 *ZENTURY BOT ACTIVADO*\n\nHola, grupo 👋\n\n✅ Este grupo ya está activado.\n⏳ Duración: ${dur}\n📅 Vence: ${new Date(cfg.vence).toLocaleDateString('es-MX')}\n\nUsa:\n.menu`
    await conn.sendMessage(groupId, { text: msg })
    return m.reply(`✅ Grupo activado por ${dur}.`)
  }

  if (command === 'desactivar') {
    const groupId = (text || '').trim() || m.chat
    deactivateGroup(groupId)
    await conn.sendMessage(groupId, { text: '🔴 *ZENTURY BOT DESACTIVADO*\n\nEste grupo ya no cuenta con activación vigente.\n\nPara contratar o renovar usa:\n.owner' })
    return m.reply('✅ Grupo desactivado.')
  }

  if (command === 'grupos') {
    const grupos = listGroups()
    if (!grupos.length) return m.reply('No hay grupos registrados todavía.')
    return m.reply('📋 *GRUPOS*\n\n' + grupos.map((g, i) => `${i + 1}. ${g.nombre || 'Sin nombre'}\nID: ${g.id}\nEstado: ${g.activo ? '🟢 Activo' : '🔴 Inactivo'}\nDías: ${daysLeft(g.vence)}`).join('\n\n'))
  }

  if (command === 'exit') {
    const groupId = (text || '').trim()
    if (!groupId) return m.reply('Uso: .exit ID_DEL_GRUPO')
    await conn.groupLeave(groupId)
    return m.reply('✅ Salí correctamente del grupo.')
  }

  if (command === 'enviaraviso') {
    const [groupId, ...msg] = (text || '').trim().split(/\s+/)
    if (!groupId || !msg.length) return m.reply('Uso: .enviaraviso ID mensaje')
    await conn.sendMessage(groupId, { text: `📢 *AVISO*\n\n${msg.join(' ')}` })
    return m.reply('✅ Aviso enviado.')
  }
}

handler.help = ['owner', 'activar', 'desactivar', 'grupos', 'exit', 'enviaraviso']
handler.tags = ['owner']
handler.command = /^(owner|activar|desactivar|grupos|exit|enviaraviso)$/i
export default handler
