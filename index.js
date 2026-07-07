process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

import './config.js'
import fs from 'fs'
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'
import { platform } from 'process'
import { spawn } from 'child_process'
import { format } from 'util'
import readline from 'readline'
import yargs from 'yargs'
import lodash from 'lodash'
import chalk from 'chalk'
import cfonts from 'cfonts'
import syntaxerror from 'syntax-error'
import NodeCache from 'node-cache'
import pino from 'pino'
import { Boom } from '@hapi/boom'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

import store from './lib/store.js'
import { makeWASocket, protoType, serialize } from './lib/simple.js'

import pkg from 'google-libphonenumber'
const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()

const { chain } = lodash

const {
  DisconnectReason,
  useMultiFileAuthState,
  MessageRetryMap,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser
} = await import('@whiskeysockets/baileys')

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix
    ? /file:\/\/\//.test(pathURL)
      ? fileURLToPath(pathURL)
      : pathURL
    : pathToFileURL(pathURL).toString()
}

global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true))
}

global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}

const __dirname = global.__dirname(import.meta.url)

global.timestamp = { start: new Date() }
global.sessions = global.sessions || 'sessions'
global.jadi = global.jadi || 'Jadibot'

const SESSIONS_DIR = `./${global.sessions}`
const JADI_DIR = `./${global.jadi}`

console.log(chalk.bold.cyanBright('\n🤖 Iniciando ZENTURY BOT\n'))

cfonts.say('ZENTURY BOT', {
  font: 'block',
  align: 'center',
  colors: ['cyanBright']
})

cfonts.say('Developed By ALAN SHOP', {
  font: 'console',
  align: 'center',
  colors: ['magentaBright']
})

protoType()
serialize()

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())

const prefixjos = '#/.-'
global.prefix = global.prefijo
  ? new RegExp('(?:^|\\S)' + global.prefijo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
  : new RegExp('(?:^|\\S)[' + (global.opts['prefix'] || prefixjos).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ']')

global.API = (name, p = '/', query = {}, apikeyqueryname) =>
  (name in global.APIs ? global.APIs[name] : name) +
  p +
  (query || apikeyqueryname
    ? '?' +
      new URLSearchParams(
        Object.entries({
          ...query,
          ...(apikeyqueryname
            ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] }
            : {})
        })
      )
    : '')

if (!fs.existsSync('./lib/storage/databaseSV')) {
  fs.mkdirSync('./lib/storage/databaseSV', { recursive: true })
}

global.db = new Low(new JSONFile('./lib/storage/databaseSV/database.json'), {})
global.DATABASE = global.db

global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this)
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
        }
      }, 1000)
    )
  }

  if (global.db.data !== null && Object.keys(global.db.data || {}).length) return

  global.db.READ = true
  await global.db.read().catch(console.error)
  global.db.READ = null

  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {})
  }

  global.db.chain = chain(global.db.data)
}

await global.loadDatabase()

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })
if (!fs.existsSync(JADI_DIR)) fs.mkdirSync(JADI_DIR, { recursive: true })
if (!fs.existsSync('./plugins')) fs.mkdirSync('./plugins', { recursive: true })
if (!fs.existsSync('./database/grupos')) fs.mkdirSync('./database/grupos', { recursive: true })
if (!fs.existsSync('./storage/img')) fs.mkdirSync('./storage/img', { recursive: true })
if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true })

const { state, saveCreds } = await useMultiFileAuthState(global.sessions)
const msgRetryCounterCache = new NodeCache()
const msgRetryCounterMap = MessageRetryMap ? new MessageRetryMap() : undefined
const { version } = await fetchLatestBaileysVersion()

const phoneNumberFromConfig = global.botNumber
const methodCodeQR = process.argv.includes('qr')
const methodCode = !!phoneNumberFromConfig || process.argv.includes('code')
const MethodMobile = process.argv.includes('mobile')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolve) => rl.question(texto, resolve))

let opcion = null
if (methodCodeQR) opcion = '1'

if (!methodCodeQR && !methodCode && !fs.existsSync(`${SESSIONS_DIR}/creds.json`)) {
  do {
    opcion = await question(
      chalk.bgMagenta.white('⌨ Seleccione una opción:\n') +
        chalk.bold.green('1. Con código QR\n') +
        chalk.bold.cyan('2. Con código de texto\n--> ')
    )
  } while (opcion !== '1' && opcion !== '2')
}

console.info = () => {}
console.debug = () => {}

const connectionOptions = {
  logger: pino({ level: 'silent' }),
  printQRInTerminal: opcion === '1' || methodCodeQR,
  mobile: MethodMobile,
  browser:
    opcion === '1' || methodCodeQR
      ? [global.nameqr || 'Zentury Bot', 'Edge', '20.0.04']
      : ['Ubuntu', 'Edge', '110.0.1587.56'],
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
  },
  markOnlineOnConnect: true,
  generateHighQualityLinkPreview: true,
  getMessage: async (clave) => {
    const jid = jidNormalizedUser(clave.remoteJid)
    const msg = await store.loadMessage(jid, clave.id)
    return msg?.message || ''
  },
  msgRetryCounterCache,
  msgRetryCounterMap,
  defaultQueryTimeoutMs: undefined,
  version
}

global.conn = makeWASocket(connectionOptions)

if (!fs.existsSync(`${SESSIONS_DIR}/creds.json`)) {
  if (opcion === '2' || methodCode) {
    opcion = '2'
    if (!global.conn.authState.creds.registered) {
      let phoneNumber = phoneNumberFromConfig

      if (!phoneNumber) {
        do {
          phoneNumber = await question(
            chalk.bold.greenBright(
              `✦ Ingresa el número WhatsApp.\nEjemplo: 5217715555998\n---> `
            )
          )
          phoneNumber = phoneNumber.replace(/\D/g, '')
          if (!phoneNumber.startsWith('+')) phoneNumber = `+${phoneNumber}`
        } while (!(await isValidPhoneNumber(phoneNumber)))

        rl.close()
      } else {
        phoneNumber = `+${String(phoneNumber).replace(/\D/g, '')}`
      }

      const addNumber = phoneNumber.replace(/\D/g, '')

      setTimeout(async () => {
        const customPairingCode = 'ALANSHOP'
        let codeBot = await global.conn.requestPairingCode(addNumber, customPairingCode)
        codeBot = codeBot?.match(/.{1,4}/g)?.join('-') || codeBot

        console.log(
          chalk.bold.white(chalk.bgMagenta('✧ CÓDIGO DE VINCULACIÓN ✧')),
          chalk.bold.white(codeBot)
        )
      }, 3000)
    }
  }
}

conn.isInit = false
global.stopped = 'init'

if (!global.opts['test']) {
  setInterval(async () => {
    if (global.db?.data) await global.db.write()
  }, 30 * 1000)
}

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin } = update
  global.stopped = connection

  if (isNewLogin) global.conn.isInit = true

  const code =
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.output?.payload?.statusCode

  if (code && code !== DisconnectReason.loggedOut && global.conn?.ws?.socket == null) {
    await global.reloadHandler(true).catch(console.error)
    global.timestamp.connect = new Date()
  }

  if (global.db.data == null) await global.loadDatabase()

  if ((update.qr && update.qr !== 0) || methodCodeQR) {
    if (opcion === '1' || methodCodeQR) {
      console.log(chalk.bold.yellow('\n❐ ESCANEA EL CÓDIGO QR'))
    }
  }

  if (connection === 'open') {
    console.log(chalk.bold.green('\n✅ ZENTURY BOT conectado correctamente\n'))
  }

  const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

  if (connection === 'close') {
    switch (reason) {
      case DisconnectReason.badSession:
        console.log(chalk.redBright(`BORRA ${global.sessions} Y VUELVE A VINCULAR.`))
        break
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.restartRequired:
      case DisconnectReason.timedOut:
        console.log(chalk.yellowBright('Reconectando...'))
        await global.reloadHandler(true).catch(console.error)
        break
      case DisconnectReason.connectionReplaced:
        console.log(chalk.yellowBright('Conexión reemplazada.'))
        break
      case DisconnectReason.loggedOut:
        console.log(chalk.redBright(`LOGOUT: borra ${global.sessions} y vincula otra vez.`))
        break
      default:
        console.log(chalk.redBright(`Desconexión desconocida: ${reason || 'N/A'}`))
        break
    }
  }
}

process.on('uncaughtException', console.error)

let isInit = true
let handler = await import('./handler.js')

global.reloadHandler = async function reloadHandler(restartConn = false) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error)
    if (Object.keys(Handler || {}).length) handler = Handler
  } catch (e) {
    console.error(e)
  }

  const oldConn = global.conn

  if (restartConn) {
    try { oldConn?.ev?.removeAllListeners() } catch {}
    try { oldConn?.ws?.close() } catch {}
    global.conn = makeWASocket(connectionOptions)
    isInit = true
  }

  const conn = global.conn

  if (!isInit && oldConn?.ev) {
    oldConn.ev.off('messages.upsert', oldConn.handler)
    oldConn.ev.off('groups.update', oldConn.groupsUpdate)
    oldConn.ev.off('group-participants.update', oldConn.participantsUpdate)
    oldConn.ev.off('connection.update', oldConn.connectionUpdate)
    oldConn.ev.off('creds.update', oldConn.credsUpdate)
    oldConn.ev.off('message.delete', oldConn.onDelete)
  }

  conn.handler = handler.handler.bind(conn)
  conn.groupsUpdate = handler.groupsUpdate.bind(conn)
  conn.participantsUpdate = handler.participantsUpdate
    ? handler.participantsUpdate.bind(conn)
    : async () => {}
  conn.onDelete = handler.deleteUpdate.bind(conn)
  conn.connectionUpdate = connectionUpdate.bind(conn)
  conn.credsUpdate = saveCreds

  conn.ev.on('messages.upsert', conn.handler)
  conn.ev.on('groups.update', conn.groupsUpdate)
  conn.ev.on('group-participants.update', conn.participantsUpdate)
  conn.ev.on('message.delete', conn.onDelete)
  conn.ev.on('connection.update', conn.connectionUpdate)
  conn.ev.on('creds.update', conn.credsUpdate)

  isInit = false
  return true
}

const pluginFolder = path.resolve(__dirname, 'plugins')
const pluginFilter = (filename) => /\.js$/.test(filename)
global.plugins = {}

global.reload = async (filename) => {
  try {
    if (!pluginFilter(filename)) return null

    filename = filename.replace(/^plugins\//, '')
    const dir = join(pluginFolder, filename)
    const name = filename.replace(/\.js$/, '')

    if (!fs.existsSync(dir)) {
      delete global.plugins[name]
      return null
    }

    const err = syntaxerror(fs.readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true
    })

    if (err) {
      console.error(`Error de sintaxis en plugin ${filename}\n${format(err)}`)
      return null
    }

    const fileUrl = pathToFileURL(dir).href
    const module = await import(`${fileUrl}?update=${Date.now()}`)

    global.plugins[name] = module.default || module
    global.plugins = Object.fromEntries(
      Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
    )

    console.log(chalk.green(`Plugin cargado: ${filename}`))
    return module
  } catch (e) {
    console.error(`Error cargando plugin ${filename}\n${format(e)}`)
    return null
  }
}

export async function filesInit(folder = 'plugins') {
  const dir = path.join(__dirname, folder)
  global.plugins = global.plugins || {}

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file)

    if (fs.statSync(fullPath).isDirectory()) {
      await filesInit(path.join(folder, file))
    } else if (file.endsWith('.js')) {
      await global.reload(path.relative(pluginFolder, fullPath).replace(/\\/g, '/'))
    }
  }

  return global.plugins
}

global.filesInit = filesInit

await filesInit('plugins')
console.log(chalk.cyan(`🌙 ${Object.keys(global.plugins).length} plugins cargados.`))

await global.reloadHandler()

setInterval(() => {
  try {
    const tmpDir = join(__dirname, 'tmp')
    if (!fs.existsSync(tmpDir)) return

    for (const file of fs.readdirSync(tmpDir)) {
      try {
        fs.unlinkSync(join(tmpDir, file))
      } catch {}
    }
  } catch {}
}, 1000 * 60 * 5)

async function isValidPhoneNumber(number) {
  try {
    number = number.replace(/\s+/g, '')
    if (number.startsWith('+521')) number = number.replace('+521', '+52')
    else if (number.startsWith('+52') && number[4] === '1') number = number.replace('+52 1', '+52')

    const parsedNumber = phoneUtil.parseAndKeepRawInput(number)
    return phoneUtil.isValidNumber(parsedNumber)
  } catch {
    return false
  }
}
