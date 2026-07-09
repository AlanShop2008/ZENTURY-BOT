import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { fileURLToPath } from 'url'
import { fileTypeFromBuffer } from 'file-type'
import * as baileys from '@whiskeysockets/baileys'

const {
  default: baileysMakeWASocket,
  proto,
  downloadContentFromMessage,
  jidDecode
} = baileys

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function pickMessage(message = {}) {
  const type = Object.keys(message || {})[0]
  return { type, msg: message?.[type] || {} }
}

function getText(message = {}) {
  const { type, msg } = pickMessage(message)

  if (!type) return ''
  if (type === 'conversation') return message.conversation || ''
  if (msg?.text) return msg.text
  if (msg?.caption) return msg.caption
  if (msg?.selectedButtonId) return msg.selectedButtonId
  if (msg?.singleSelectReply?.selectedRowId) return msg.singleSelectReply.selectedRowId
  if (msg?.selectedId) return msg.selectedId

  return ''
}

function getQuoted(conn, m, contextInfo = {}) {
  if (!contextInfo?.quotedMessage) return null

  const quotedMessage = contextInfo.quotedMessage
  const quotedType = Object.keys(quotedMessage || {})[0]
  const quotedMsg = quotedMessage?.[quotedType] || {}
  const quotedSender = conn.decodeJid(contextInfo.participant || m.chat)

  const quoted = {
    type: quotedType,
    msg: quotedMsg,
    message: quotedMessage,
    sender: quotedSender,
    chat: m.chat,
    id: contextInfo.stanzaId,
    text: getText(quotedMessage),
    key: {
      remoteJid: m.chat,
      fromMe: quotedSender === conn.decodeJid(conn.user?.id || conn.user?.jid || ''),
      id: contextInfo.stanzaId,
      participant: quotedSender
    },
    async download() {
      return conn.downloadM(quotedMsg, quotedType.replace('Message', ''))
    }
  }

  quoted.reply = (text, chatId = m.chat, options = {}) => conn.reply(chatId, text, quoted, options)

  return quoted
}

export function makeWASocket(connectionOptions, options = {}) {
  const conn = baileysMakeWASocket(connectionOptions)

  conn.chats = conn.chats || options.chats || {}

  conn.decodeJid = function decodeJid(jid = '') {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {}
      return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid
    }
    return jid
  }

  conn.reply = function reply(jid, text = '', quoted, options = {}) {
    return conn.sendMessage(jid, { text, ...options }, { quoted })
  }

  conn.getName = async function getName(jid = '') {
    jid = conn.decodeJid(jid)
    if (jid.endsWith('@g.us')) {
      const meta = await conn.groupMetadata(jid).catch(() => null)
      return meta?.subject || jid
    }
    return jid.split('@')[0]
  }

  conn.parseMention = function parseMention(text = '') {
    return [...String(text).matchAll(/@([0-9]{5,20})/g)].map(v => `${v[1]}@s.whatsapp.net`)
  }

  conn.getFile = async function getFile(PATH, saveToFile = false) {
    let data
    let res
    let filename

    if (Buffer.isBuffer(PATH)) data = PATH
    else if (/^https?:\/\//.test(PATH)) {
      res = await fetch(PATH)
      data = Buffer.from(await res.arrayBuffer())
    } else if (fs.existsSync(PATH)) {
      filename = PATH
      data = fs.readFileSync(PATH)
    } else if (typeof PATH === 'string') {
      data = Buffer.from(PATH)
    } else {
      data = Buffer.alloc(0)
    }

    const type = (await fileTypeFromBuffer(data).catch(() => null)) || {
      mime: 'application/octet-stream',
      ext: 'bin'
    }

    if (saveToFile && !filename) {
      const dir = path.join(__dirname, '../tmp')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      filename = path.join(dir, `${Date.now()}.${type.ext}`)
      fs.writeFileSync(filename, data)
    }

    return { res, filename, ...type, data }
  }

  conn.sendFile = async function sendFile(jid, file, filename = '', caption = '', quoted, ptt = false, options = {}) {
    const type = await conn.getFile(file, true)
    const mime = options.mimetype || type.mime

    let message = { document: { url: type.filename }, fileName: filename || path.basename(type.filename), mimetype: mime, caption, ...options }

    if (/image/.test(mime)) message = { image: { url: type.filename }, caption, ...options }
    else if (/video/.test(mime)) message = { video: { url: type.filename }, caption, mimetype: mime, ...options }
    else if (/audio/.test(mime)) message = { audio: { url: type.filename }, mimetype: mime, ptt, ...options }

    return conn.sendMessage(jid, message, { quoted })
  }

  conn.downloadM = async function downloadM(message, type = '') {
    if (!message) return Buffer.alloc(0)

    const msgType = type || Object.keys(message || {})[0]?.replace('Message', '')
    const stream = await downloadContentFromMessage(message, msgType)
    let buffer = Buffer.from([])

    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }

    return buffer
  }

  conn.loadMessage = function loadMessage(id) {
    for (const chat of Object.values(conn.chats || {})) {
      if (chat?.messages?.[id]) return chat.messages[id]
    }
    return null
  }

  conn.serializeM = function serializeM(m) {
    return smsg(conn, m)
  }

  conn.pushMessage = async function pushMessage(messages = []) {
    if (!Array.isArray(messages)) messages = [messages]
    for (const message of messages) {
      const chat = conn.decodeJid(message?.key?.remoteJid || '')
      if (!chat) continue
      conn.chats[chat] = conn.chats[chat] || { id: chat, messages: {} }
      if (message?.key?.id) conn.chats[chat].messages[message.key.id] = message
    }
  }

  return conn
}

export function smsg(conn, m) {
  if (!m) return m

  const message = m.message || {}
  const { type, msg } = pickMessage(message)

  m.id = m.key?.id
  m.chat = conn.decodeJid(m.key?.remoteJid || '')
  m.isGroup = m.chat.endsWith('@g.us')
  m.sender = conn.decodeJid(
    m.key?.fromMe
      ? (conn.user?.id || conn.user?.jid || '')
      : (m.participant || m.key?.participant || m.key?.remoteJid || '')
  )
  m.fromMe = !!m.key?.fromMe
  m.mtype = type
  m.msg = msg
  m.text = getText(message)
  m.name = m.pushName || ''
  m.mentionedJid = msg?.contextInfo?.mentionedJid || []
  m.quoted = getQuoted(conn, m, msg?.contextInfo || null)

  m.reply = (text, chatId = m.chat, options = {}) => conn.reply(chatId, text, m, options)
  m.react = (emoji) => conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => {})
  m.download = async () => conn.downloadM(msg, type.replace('Message', ''))

  return m
}

export function protoType() {
  if (!String.prototype.decodeJid) {
    Object.defineProperty(String.prototype, 'decodeJid', {
      value() {
        const jid = this.toString()
        if (/:\d+@/gi.test(jid)) {
          const decode = jidDecode(jid) || {}
          return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid
        }
        return jid
      }
    })
  }
}

export function serialize() {
  return true
}
