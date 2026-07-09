import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
const { proto } = (await import('@whiskeysockets/baileys')).default
import fs from 'fs'
import ws from 'ws' 
import chalk from 'chalk'

const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () {
    clearTimeout(this)
    resolve()
}, ms))


// ===============================
// ZENTURY BOT - CORE HELPERS
// ===============================
const ZENTURY_DATA = './database'
const ZENTURY_GROUPS_DIR = './database/grupos'
const ZENTURY_GROUPS_FILE = './database/grupos.json'
const ZENTURY_OWNER_NUMBER = '5217715555998'

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function cleanNumber(jid = '') {
  return String(jid).replace(/[^0-9]/g, '')
}

function ownerNumbers() {
  const fromConfig = Array.isArray(global.owner)
    ? global.owner.map(v => Array.isArray(v) ? v[0] : v)
    : []
  return [...new Set([...fromConfig, ZENTURY_OWNER_NUMBER].map(v => cleanNumber(v)).filter(Boolean))]
}

function ownerLids() {
  return Array.isArray(global.ownerLid) ? global.ownerLid : []
}

function isZenturyOwner(jid = '') {
  return ownerNumbers().includes(cleanNumber(jid)) || ownerLids().includes(jid)
}

function groupPath(groupId) {
  return path.join(ZENTURY_GROUPS_DIR, groupId)
}

function groupFile(groupId, name) {
  return path.join(groupPath(groupId), name)
}

function defaultGroupConfig(groupId, name = '') {
  return {
    id: groupId,
    nombre: name,
    activo: false,
    vence: 0,
    creado: Date.now(),
    actualizado: Date.now(),
    agregadoPor: '',
    modoJoin: false
  }
}

function ensureZenturyBase() {
  ensureDir(ZENTURY_DATA)
  ensureDir(ZENTURY_GROUPS_DIR)
  if (!fs.existsSync(ZENTURY_GROUPS_FILE)) writeJSON(ZENTURY_GROUPS_FILE, [])
}

function ensureZenturyGroup(groupId, name = '') {
  if (!groupId || !String(groupId).endsWith('@g.us')) return null
  ensureZenturyBase()
  ensureDir(groupPath(groupId))

  const files = {
    'config.json': defaultGroupConfig(groupId, name),
    'inventario.json': {},
    'vendidas.json': [],
    'ventas.json': [],
    'clientes.json': {},
    'saldos.json': {},
    'asistentes.json': [],
    'comandos.json': {},
    'sorteos.json': {},
    'logs.json': []
  }

  for (const [file, fallback] of Object.entries(files)) {
    const full = groupFile(groupId, file)
    if (!fs.existsSync(full)) writeJSON(full, fallback)
  }

  const cfgFile = groupFile(groupId, 'config.json')
  const cfg = readJSON(cfgFile, defaultGroupConfig(groupId, name))
  if (name && cfg.nombre !== name) cfg.nombre = name
  cfg.actualizado = Date.now()
  writeJSON(cfgFile, cfg)

  const grupos = readJSON(ZENTURY_GROUPS_FILE, [])
  const idx = grupos.findIndex(g => g.id === groupId)
  const item = {
    id: groupId,
    nombre: cfg.nombre || name || groupId,
    activo: !!cfg.activo,
    vence: cfg.vence || 0,
    actualizado: Date.now()
  }
  if (idx === -1) grupos.push(item)
  else grupos[idx] = { ...grupos[idx], ...item }
  writeJSON(ZENTURY_GROUPS_FILE, grupos)
  return cfg
}

function isGroupActive(groupId) {
  if (!groupId || !String(groupId).endsWith('@g.us')) return true
  ensureZenturyGroup(groupId)
  const cfg = readJSON(groupFile(groupId, 'config.json'), defaultGroupConfig(groupId))
  if (!cfg.activo) return false
  if (cfg.vence && Date.now() > cfg.vence) {
    cfg.activo = false
    cfg.actualizado = Date.now()
    writeJSON(groupFile(groupId, 'config.json'), cfg)
    return false
  }
  return true
}

function parseCommandText(text = '') {
  text = String(text || '').trim()
  const prefixes = ['.', '#', '/', '-']
  if (!prefixes.includes(text[0])) return { isCmd: false, command: '', args: [], text: '' }
  const body = text.slice(1).trim()
  const [cmd = '', ...args] = body.split(/\s+/)
  return { isCmd: true, command: cmd.toLowerCase(), args, text: args.join(' ') }
}

function containsAnyLink(text = '') {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|bit\.ly\/|tinyurl\.com\/|discord\.gg\/|[a-z0-9-]+\.[a-z]{2,})(\S*)/i.test(String(text || ''))
}

async function sendOwnerPrivate(conn, text) {
  for (const n of ownerNumbers()) {
    const jid = `${n}@s.whatsapp.net`
    await conn.sendMessage(jid, { text }).catch(() => {})
  }
}

async function sendOwnerContact(conn, chat, quoted) {
  const number = ZENTURY_OWNER_NUMBER
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:ALAN SHOP - Owner Zentury Bot\nORG:ALAN SHOP;\nTEL;type=CELL;type=VOICE;waid=${number}:${number}\nEND:VCARD`
  await conn.sendMessage(chat, {
    contacts: {
      displayName: 'ALAN SHOP',
      contacts: [{ vcard }]
    }
  }, { quoted }).catch(async () => {
    await conn.sendMessage(chat, { text: `👑 Owner oficial: wa.me/${number}` }, { quoted }).catch(() => {})
  })
}

async function notifyBotAdded(conn, groupId, addedBy = '') {
  let meta = await conn.groupMetadata(groupId).catch(() => null)
  const name = meta?.subject || groupId
  const total = meta?.participants?.length || 0
  ensureZenturyGroup(groupId, name)
  await sendOwnerPrivate(conn, `🚨 *ME AGREGARON A UN GRUPO*\n\n👥 Grupo: ${name}\n🆔 ID: ${groupId}\n👤 Agregado por: ${addedBy ? '@' + cleanNumber(addedBy) : 'No detectado'}\n👥 Participantes: ${total}\n\nEstado: 🔴 No activado`)
}


export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    if (!chatUpdate) return
    this.pushMessage(chatUpdate.messages).catch(console.error)
    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m) return
    if (global.db.data == null) await global.loadDatabase()
    try {
        m = smsg(this, m) || m
        if (!m) return
        m.exp = 0

        let isBotPrem = false;
        if (!isBotPrem) {
            try {
                const botJid = (this.user?.jid || this.user?.id || global.conn?.user?.jid || global.conn?.user?.id || '').split('@')[0];
                const premiumFilePath = path.join(`./${global.jadi}`, botJid, 'premium.json');
                if (fs.existsSync(premiumFilePath)) {
                    const premiumConfig = JSON.parse(fs.readFileSync(premiumFilePath, 'utf8'));
                    isBotPrem = premiumConfig.premiumBot === true;
                }
            } catch (e) {
                console.error('Error al verificar el estado premium del bot:', e);
            }
        }

        try {
            global.db.data.users[m.sender] = global.db.data.users[m.sender] || {}
            let user = global.db.data.users[m.sender]
            if (typeof user !== 'object') {
                user = global.db.data.users[m.sender] = {
                    exp: 0,
                    coin: 50,
                    lastmiming: 0,
                    lastclaim: 0,
                    registered: false,
                    name: m.name,
                    age: -1,
                    regTime: -1,
                    afk: -1,
                    afkReason: '',
                    banned: false,
                    warn: 0,
                    level: 0,
                    role: 'Novato',
                    autolevelup: false,
                    chatbot: false,
                }
            }
            let chat = global.db.data.chats[m.chat]
            if (typeof chat !== 'object') global.db.data.chats[m.chat] = {}
            if (chat) {
                if (!('isBanned' in chat)) chat.isBanned = false
                if (!('welcome' in chat)) chat.welcome = true
                if (!('detect' in chat)) chat.detect = false
                if (!('sWelcome' in chat)) chat.sWelcome = ''
                if (!('sBye' in chat)) chat.sBye = ''
                if (!('sPromote' in chat)) chat.sPromote = ''
                if (!('sDemote' in chat)) chat.sDemote = ''
                if (!('antiLink' in chat)) chat.antiLink = true
                if (!('viewonce' in chat)) chat.viewonce = false
                if (!('autoresponder' in chat)) chat.autoresponder = false
                if (!('onlyLatinos' in chat)) chat.onlyLatinos = false
                if (!('nsfw' in chat)) chat.nsfw = false
                if (!('antiLag' in chat)) chat.antiLag = false
                if (!('allantilink' in chat)) chat.allantilink = true
                if (!('per' in chat)) chat.per = []
                if (!isNumber(chat.expired)) chat.expired = 0
            } else global.db.data.chats[m.chat] = {
                isBanned: false,
                antiLag: false,
                per: [],
                welcome: true,
                detect: false,
                sWelcome: '',
                sBye: '',
                sPromote: '',
                sDemote: '',
                autoresponder: false,
                antiLink: true,
                viewonce: false,
                useDocument: true,
                onlyLatinos: false,
                nsfw: false, 
                allantilink: true,
                expired: 0,
            }
            let settings = global.db.data.settings[this.user?.jid || this.user?.id || 'bot']
            if (typeof settings !== 'object') global.db.data.settings[this.user?.jid || this.user?.id || 'bot'] = {}
            if (settings) {
                if (!('self' in settings)) settings.self = false
                if (!('autoread' in settings)) settings.autoread = false
                if (!('restrict' in settings)) settings.restrict = true
                if (!('actives' in settings)) settings.actives = []
                if (!('status' in settings)) settings.status = 0
                if (!('noprefix' in settings)) settings.noprefix = false
                if (!('logo' in settings)) settings.logo = null
            } else global.db.data.settings[this.user?.jid || this.user?.id || 'bot'] = {
                self: false,
                autoread: false,
                restrict: true, 
                actives: [],
                status: 0,
                noprefix: false,
                logo: "",
            }
        } catch (e) {
            console.error(e)
        }

        const mainBot = global.conn?.user?.jid || global.conn?.user?.id || this.user?.jid || this.user?.id || ''
        const chat = global.db.data.chats[m.chat] || {}
        const isSubbs = chat.antiLag === true
        const allowedBots = chat.per || []
        if (!allowedBots.includes(mainBot)) allowedBots.push(mainBot)
        const isAllowed = allowedBots.includes(this.user.jid)
        if (isSubbs && !isAllowed) return
        if (opts['nyimak']) return

        if (m.isBaileys && !m.fromMe) return
        if (!m.fromMe && opts['self']) return
        if (opts['pconly'] && m.chat.endsWith('g.us')) return
        if (opts['gconly'] && !m.chat.endsWith('g.us')) return
        if (opts['swonly'] && m.chat !== 'status@broadcast') return
        if (typeof m.text !== 'string') m.text = ''

        const sendNum = String(m.sender || '').replace(/[^0-9]/g, '')
const botUserJid = this.user?.jid || this.user?.id || global.conn?.user?.jid || global.conn?.user?.id || ''
const decodedBot = this.decodeJid ? this.decodeJid(botUserJid) : botUserJid

const isROwner = [
  cleanNumber(decodedBot),
  ...ownerNumbers()
].includes(sendNum)

const isSubBot = [
  botUserJid,
  decodedBot,
  ...ownerNumbers().map(number => `${number}@s.whatsapp.net`)
].includes(m.sender)

const isPremSubs = global.db.data.users[m.sender]?.token === true && Array.isArray(global.conns)
  ? global.conns
      .map(c => this.decodeJid ? this.decodeJid(c.user?.id || '') : (c.user?.id || ''))
      .map(v => cleanNumber(v))
      .includes(cleanNumber(sendNum || m.sender || ''))
  : false

       const isOwner = isROwner     
       const modList = global.mods.map(v => v.replace(/[^0-9]/g, ''))
       const isMod = modList.includes(sendNum)
       const isMods = isOwner || isROwner || isMod
        const isPrems = isROwner || global.prems.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)

        if (opts['queque'] && m.text && !(isMods || isPrems)) {
            let queque = this.msgqueque, time = 1000 * 5
            const previousID = queque[queque.length - 1]
            queque.push(m.id || m.key.id)
            setInterval(async function () {
                if (queque.indexOf(previousID) === -1) clearInterval(this)
                await delay(time)
            }, time)
        }
if (m.isBaileys)
            return
        m.exp += Math.ceil(Math.random() * 10)
        let usedPrefix
        let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]

async function getLidFromJid(id, conn) {
id = String(id || '')
if (!id) return ''
if (id.endsWith('@lid')) return id
const res = await conn.onWhatsApp(id).catch(() => [])
return res[0]?.lid || id
}
const senderLid = await getLidFromJid(m.sender, this)
const botLid = await getLidFromJid(this.user?.jid || this.user?.id || '', this)
const senderJid = m.sender
const botJid = this.user?.jid || this.user?.id || ''
const groupMetadata = m.isGroup ? ((this.chats?.[m.chat] || {}).metadata || await this.groupMetadata(m.chat).catch(_ => null)) : {}
const participants = m.isGroup ? (groupMetadata?.participants || []) : []
const user = participants.find(p => p.id === senderLid || p.phoneNumber === senderJid || p.jid === senderJid) || {};
const isRAdmin = user?.admin === "superadmin" || user?.admin === "admin";
const isAdmin = isRAdmin || user?.admin === "admin";
const bot = participants.find(p => p.id === botLid || p.phoneNumber === botJid || p.jid === botJid) || {};
const isBotAdmin = !!bot?.admin;

// ===============================
// ZENTURY BOT - SEGURIDAD / ACTIVACIÓN / COMANDOS PERSONALIZADOS
// ===============================
try {
  if (m.isGroup) {
    ensureZenturyGroup(m.chat, groupMetadata?.subject || '')
  }

  const parsedZ = parseCommandText(m.text)
  const senderIsOwnerZ = isZenturyOwner(m.sender)

  // ANTILINK GLOBAL: borra cualquier link y expulsa al usuario.
  // Excepciones: owner del bot, admins y mensajes del propio bot.
  if (m.isGroup && !m.fromMe && containsAnyLink(m.text) && !senderIsOwnerZ && !isAdmin) {
    try { await this.sendMessage(m.chat, { delete: m.key }) } catch {}
    if (isBotAdmin) {
      await this.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {})
      await this.sendMessage(m.chat, { text: `🚫 *LINK DETECTADO*\n\n🗑️ Mensaje eliminado.\n👢 Usuario expulsado automáticamente.` }).catch(() => {})
    } else {
      await this.sendMessage(m.chat, { text: `🚫 *LINK DETECTADO*\n\nNecesito ser admin para eliminar y expulsar.` }).catch(() => {})
    }
    return
  }

  // Si el grupo no está activado, solo funciona .owner para clientes.
  // El owner sí puede usar comandos de administración para activar/desactivar.
  if (m.isGroup && parsedZ.isCmd) {
    const active = isGroupActive(m.chat)
    const ownerCommands = ['activar', 'desactivar', 'estado', 'owner', 'grupos', 'exit', 'enviaraviso', 'join', 'setbanner', 'id', 'ping']
    if (!active && parsedZ.command !== 'owner' && !(senderIsOwnerZ && ownerCommands.includes(parsedZ.command))) {
      await this.sendMessage(m.chat, {
        text: `🔒 *BOT NO ACTIVADO*\n\nEste grupo aún no cuenta con activación.\n\nPara contratar *Zentury Bot*, usa:\n\n.owner`
      }, { quoted: m }).catch(() => {})
      return
    }
  }

  // .owner funciona incluso en grupos no activados.
  if (parsedZ.isCmd && parsedZ.command === 'owner') {
    await this.sendMessage(m.chat, {
      text: `👑 *ADMINISTRADOR OFICIAL*\n\nPara contratar o activar *Zentury Bot*, guarda el contacto que te envío abajo.`
    }, { quoted: m }).catch(() => {})
    await sendOwnerContact(this, m.chat, m)
    return
  }

  // Comandos personalizados por grupo: .pago, .chelada, etc.
  if (m.isGroup && parsedZ.isCmd) {
    const comandosFile = groupFile(m.chat, 'comandos.json')
    const personalizados = readJSON(comandosFile, {})
    if (personalizados[parsedZ.command]) {
      await this.sendMessage(m.chat, { text: String(personalizados[parsedZ.command]) }, { quoted: m }).catch(() => {})
      return
    }
  }
} catch (e) {
  console.error('Zentury core error:', e)
}


        const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './commands')
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin)
                continue
            if (plugin.disabled)
                continue
            const __filename = join(___dirname, name)
            if (typeof plugin.all === 'function') {
                try {
                    await plugin.all.call(this, m, {
                        chatUpdate,
                        __dirname: ___dirname,
                        __filename
                    })
                } catch (e) {
                    console.error(e)
                }
            }
            if (!opts['restrict'])
                if (plugin.tags && plugin.tags.includes('admin')) {
                    continue
                }
            const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
            let _prefix = plugin.customPrefix ? plugin.customPrefix : global.db.data.settings[this?.user?.jid || this?.user?.id || 'bot']?.noprefix ? "" : this.prefix ? this.prefix : global.prefix
            let match = (_prefix instanceof RegExp ? 
                [[_prefix.exec(m.text), _prefix]] :
                Array.isArray(_prefix) ? 
                    _prefix.map(p => {
                        let re = p instanceof RegExp ? 
                            p :
                            new RegExp(str2Regex(p))
                        return [re.exec(m.text), re]
                    }) :
                    typeof _prefix === 'string' ? 
                        [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
                        [[[], new RegExp]]
            ).find(p => p[1])
            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }))
                    continue
            }
            if (typeof plugin !== 'function')
                continue
        if ((usedPrefix = (match && match[0]) || (global.db.data.settings[this.user?.jid || this.user?.id || 'bot']?.noprefix && ''))) {
                let noPrefix = m.text.replace(usedPrefix, '')
                let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
                args = args || []
                let _args = noPrefix.trim().split` `.slice(1)
                let text = _args.join` `
                command = (command || '').toLowerCase()
                let fail = plugin.fail || global.dfail // When failed
                let isAccept = plugin.command instanceof RegExp ? 
                    plugin.command.test(command) :
                    Array.isArray(plugin.command) ? 
                        plugin.command.some(cmd => cmd instanceof RegExp ? 
                            cmd.test(command) :
                            cmd === command
                        ) :
                        typeof plugin.command === 'string' ? 
                            plugin.command === command :
                            false

                if (!isAccept)
                    continue
                m.plugin = name
                if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
                    let chat = global.db.data.chats[m.chat]
                    let user = global.db.data.users[m.sender]
                 m.handler = name
                    if (name != 'owner-unbanchat.js' && chat?.isBanned && !plugin.allowBanned)
                        return // Except this
                    if (name != 'owner-unbanuser.js' && user?.banned)
                        return
                }
                if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) { 
                    fail('owner', m, this)
                    continue
                }
                if (plugin.rowner && !isROwner) { 
                    fail('rowner', m, this)
                    continue
                }
                if (plugin.owner && !isOwner) { 
                    fail('owner', m, this)
                    continue
                }
                if (plugin.botprem && !isBotPrem) { 
          fail('botprem', m, this, usedPrefix, command);
          continue;
        }
                if (plugin.mods && !isMods) { 
                    fail('mods', m, this)
                    continue
                }
                if (plugin.premium && !isPrems) { 
                    fail('premium', m, this)
                    continue
                }
                if (plugin.group && !m.isGroup) { 
                    fail('group', m, this)
                    continue
                } else if (plugin.botAdmin && !isBotAdmin) { 
                    fail('botAdmin', m, this)
                    continue
                } else if (plugin.admin && !isAdmin) { 
                    fail('admin', m, this)
                    continue
                }
                if (plugin.private && m.isGroup) { 
                    fail('private', m, this)
                    continue
                }
                if (plugin.register == true && _user.registered == false) { 
                    fail('unreg', m, this)
                    continue
                }
                m.isCommand = true
                let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17 // XP Earning per command
                if (xp > 200)
                    m.reply('chirrido -_-') // Hehehe
                else
                    m.exp += xp
                let extra = {
                    match,
                    usedPrefix,
                    noPrefix,
                    _args,
                    args,
                    command,
                    text,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isBotPrem,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }
              /*  try {
                    await plugin.call(this, m, extra)
                } catch (e) {
                    m.error = e
                    console.error(e)
                    if (e) {
                        let text = format(e)
                        for (let key of Object.values(global.APIKeys))
                            text = text.replace(new RegExp(key, 'g'), '#HIDDEN#')
}
                        if (e.name)
                            for (let [jid] of global.owner.filter(([number, _, isDeveloper]) => isDeveloper && number)) {
                                let data = (await conn.onWhatsApp(jid))[0] || {}
                                if (data.exists)
                                      m.reply(`*✧ Plugin:* ${m.plugin}\n*✧ Emisor:* ${m.sender}\n*✧ Chat:* ${m.chat}\n*✧ Comando:* ${usedPrefix}${command} ${args.join(' ')}\n✧ *Error Logs:*\n\n\`\`\`${e}\`\`\``.trim(), data.jid)
                            }

if (e.name) {
    console.error('Plugin error:', e)
}
*/

/* try {
  await plugin.call(this, m, extra)
} catch (e) {
  m.error = e
  console.error(e)

  if (e) {
    let text = format(e)
    for (let key of Object.values(global.APIKeys || {})) {
      text = text.replace(new RegExp(key, 'g'), '#HIDDEN#')
    }
  }

  if (e?.name) {
    console.error('Plugin error:', e.name)
  }
}
                } finally {
                    // m.reply(util.format(_user))
                    if (typeof plugin.after === 'function') {
                        try {
                            await plugin.after.call(this, m, extra)
                        } catch (e) {
                            console.error(e)
                        }
                    }
                }
*/
try {
  await plugin.call(this, m, extra)
} catch (e) {
  m.error = e
  console.error(e)

  if (e) {
    let text = format(e)
    for (let key of Object.values(global.APIKeys || {})) {
      text = text.replace(new RegExp(key, 'g'), '#HIDDEN#')
    }
  }

  if (e?.name) {
    console.error('Plugin error:', e.name)
  }
} finally {
  if (typeof plugin.after === 'function') {
    try {
      await plugin.after.call(this, m, extra)
    } catch (e) {
      console.error(e)
    }}}
                break
            }
        }
    } catch (e) {
        console.error(e)
    } finally {
        if (opts['queque'] && m.text) {
            const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
            if (quequeIndex !== -1)
                this.msgqueque.splice(quequeIndex, 1)
        }

        let user, stats = global.db.data.stats
        if (m) {
            if (m.sender && (user = global.db.data.users[m.sender])) {
                user.exp += m.exp
            }

            let stat
            if (m.plugin) {
                let now = +new Date
                if (m.plugin in stats) {
                    stat = stats[m.plugin]
                    if (!isNumber(stat.total))
                        stat.total = 1
                    if (!isNumber(stat.success))
                        stat.success = m.error != null ? 0 : 1
                    if (!isNumber(stat.last))
                        stat.last = now
                    if (!isNumber(stat.lastSuccess))
                        stat.lastSuccess = m.error != null ? 0 : now
                } else
                    stat = stats[m.plugin] = {
                        total: 1,
                        success: m.error != null ? 0 : 1,
                        last: now,
                        lastSuccess: m.error != null ? 0 : now
                    }
                stat.total += 1
                stat.last = now
                if (m.error == null) {
                    stat.success += 1
                    stat.lastSuccess = now
                }
            }
        }

        try {
            if (!opts['noprint']) await (await import(`./lib/print.js`)).default(m, this)
        } catch (e) {
            console.log(m, m.quoted, e)
        }
        if (opts['autoread'])
            await this.chatRead(m.chat, m.isGroup ? m.sender : undefined, m.id || m.key.id).catch(() => { })
    }
}

export async function participantsUpdate({ id, participants, action }) {
    if (opts['self'])
        return
    if (this.isInit)
        return
    if (global.db.data == null)
        await loadDatabase()
let chat = global.db.data.chats[id] || {}
    let text = ''
    switch (action) {

        case 'add':
            try {
                const botId = this.user?.jid || this.user?.id || global.conn?.user?.jid || ''
                const botNum = cleanNumber(botId)
                const wasBotAdded = participants.some(p => cleanNumber(p) === botNum)
                if (wasBotAdded) {
                    ensureZenturyGroup(id, (await this.groupMetadata(id).catch(() => null))?.subject || '')
                    await notifyBotAdded(this, id, '')
                    await this.sendMessage(id, {
                        text: `🔒 *ZENTURY BOT*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n¡Hola! 👋\n\nGracias por agregarme a este grupo.\n\n⚠️ Este bot *NO se encuentra activado* para este grupo.\n\nPara contratar el servicio o solicitar la activación, usa:\n\n.owner\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nUna vez activado podrás usar:\n\n🛒 Tienda automática\n🎵 Música\n👥 Administración\n🛡️ Antilink\n🎁 Sorteos\n🤖 Herramientas\n\nGracias por tu interés en *Zentury Bot*. 🚀`
                    }).catch(() => {})
                    await sendOwnerContact(this, id, null)
                    return
                }
            } catch (e) { console.error('Bienvenida bot error:', e) }
        case 'remove':
            if (chat.welcome) {
                let groupMetadata = await this.groupMetadata(id).catch(() => null) || (this.chats?.[id] || {}).metadata || {}
                for (let user of participants) {
                    text = (action === 'add' ? (chat.sWelcome || this.welcome || global.conn?.welcome || 'Bienvenido, @user').replace('@group', await this.getName(id)).replace('@desc', groupMetadata.desc?.toString() || 'Desconocido') :
                        (chat.sBye || this.bye || global.conn?.bye || 'Adiós, @user')).replace('@user', '@' + user.split('@')[0])
                    let pp = global.db.data.settings[this.user?.jid || this.user?.id || 'bot']?.logo || await this.profilePictureUrl(user, "image").catch(_ => imgM)
                    this.sendFile(id, action === 'add' ? pp : pp, 'pp.jpg', text, null, false, { mentions: [user] })
                }
            }
            break
        case 'promote':
            text = (chat.sPromote || this.spromote || global.conn?.spromote || '@user ahora es administrador')
        case 'demote':
            let pp = await this.profilePictureUrl(participants[0], 'image').catch(_ => logo) 
            if (!text)
                text = (chat.sDemote || this.sdemote || global.conn?.sdemote || '@user ya no es administrador')
            text = text.replace('@user', '@' + participants[0].split('@')[0])
            if (chat.detect)    
            this.sendFile(id, pp, 'pp.jpg', text, null, false, { mentions: this.parseMention(text) })
            break
    }
}

export async function groupsUpdate(groupsUpdate) {
    if (opts['self'])
        return
    if (this.isInit)
        return

    for (const groupUpdate of groupsUpdate) {
        const id = groupUpdate.id
        if (!id) continue
        let chats = global.db.data.chats[id], text = ''
        if (!chats?.detect) continue
        if (groupUpdate.desc && groupUpdate.desc !== (chats.lastDesc || '')) {
            text = (chats.sDesc || this.sDesc || conn.sDesc || 'Descripción cambiada a \n@desc')
                .replace('@desc', groupUpdate.desc)
            chats.lastDesc = groupUpdate.desc
        }
        if (groupUpdate.subject && groupUpdate.subject !== (chats.lastSubject || '')) {
            text = (chats.sSubject || this.sSubject || conn.sSubject || 'El nombre del grupo cambió a \n@group')
                .replace('@group', groupUpdate.subject)
            chats.lastSubject = groupUpdate.subject
        }
        if (groupUpdate.icon && groupUpdate.icon !== (chats.lastIcon || '')) {
            text = (chats.sIcon || this.sIcon || conn.sIcon || 'El icono del grupo cambió a')
                .replace('@icon', groupUpdate.icon)
            chats.lastIcon = groupUpdate.icon
        }
        if (groupUpdate.revoke && groupUpdate.revoke !== (chats.lastRevoke || '')) {
            text = (chats.sRevoke || this.sRevoke || conn.sRevoke || 'El enlace del grupo cambia a\n@revoke')
                .replace('@revoke', groupUpdate.revoke)
            chats.lastRevoke = groupUpdate.revoke
        }
        if (!text) continue
        await this.sendMessage(id, { text, mentions: this.parseMention(text) })
    }
}


 export async function deleteUpdate(message) {
    try {
        const { fromMe, id, participant } = message
        if (fromMe)
            return
        let msg = this.serializeM(this.loadMessage(id))
        if (!msg)
            return
        let chat = global.db.data.chats[msg.chat] || {}
        if (chat.delete)
            return
       /*this.reply(msg.chat, `
_@${participant.split`@`[0]} eliminó un mensaje._
*✧ Para desactivar esta función escribe:*
*.on delete*
          
*✧ Para eliminar los mensajes del bot escribe:*
*.delete*`, msg)
    } catch (e) {
        console.error(e)
    }
}
*/
    } catch (e) {
        console.error(e)
    }
}

global.dfail = async (type, m, conn, usedPrefix) => { 
const msg = {
rowner: '《★》Esta función solo puede ser usada por mi creador',
botprem: '《★》Esta función solo puede ser usada por sesiones premiums.', 
owner: '《★》Esta función solo puede ser usada por mi desarrollador.', 
mods: '《★》Esta función solo puede ser usada por los moderadores del bot', 
premium: '《★》Esta función solo es para usuarios Premium.', 
group: '《★》Esta funcion solo puede ser ejecutada en grupos.', 
private: '《★》Esta función solo puede ser usada en chat privado.', 
admin: '《★》Este comando solo puede ser usado por admins.', 
botAdmin: '《★》Para usar esta función debo ser admin.',
unreg: `《★》No te encuentras registrado, registrese para usar esta función\n*/reg nombre.edad*\n\n*Ejemplo* : */reg Alan.21*`,
restrict: '《★》Esta característica esta desactivada.'
}[type];
if (msg) return conn.reply(m.chat, msg, m).then(_ => m.react('✖️'))}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
    unwatchFile(file)
    console.log(chalk.magenta("✅  Se actualizo 'handler.js'"))
    if (global.reloadHandler) console.log(await global.reloadHandler())
})
