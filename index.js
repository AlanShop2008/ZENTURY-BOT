process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

import './config.js'
import chokidar from 'chokidar'
import fs from 'fs'
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'
import { platform } from 'process'
import { spawn } from 'child_process'
import { format } from 'util'

import yargs from 'yargs'
import lodash from 'lodash'
import chalk from 'chalk'
import cfonts from 'cfonts'
import syntaxerror from 'syntax-error'
import NodeCache from 'node-cache'
import readline from 'readline'

import pino from 'pino'
import { Boom } from '@hapi/boom'
import { Low, JSONFile } from 'lowdb'

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
  jidNormalizedUser,
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

global.timestamp = { start: new Date() }
global.sessions = global.sessions || 'SESSIONS'
global.jadi = global.jadi || 'Jadibot'

const __dirname = global.__dirname(import.meta.url)
const SESSIONS_DIR = `./${global.sessions}`
const JADI_DIR = `./${global.jadi}`

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000


// ===============================
// ZENTURY CORE - Carpetas base
// ===============================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function ensureJson(file, data) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function ensureZenturyCore() {
  ensureDir('./plugins')
  ensureDir('./lib')
  ensureDir('./database')
  ensureDir('./database/grupos')
  ensureDir('./storage')
  ensureDir('./storage/img')
  ensureDir('./storage/audio')
  ensureDir('./storage/video')
  ensureDir('./storage/tmp')
  ensureDir('./sessions')
  ensureJson('./database/grupos.json', [])

  const banner = './storage/img/catalogo.png'
  if (!fs.existsSync(banner)) {
    fs.writeFileSync('./storage/img/README.txt', 'Coloca aquí catalogo.png o usa .setbanner desde WhatsApp')
  }
}

ensureZenturyCore()

let initPersonalizacion = async () => {}
try {
  const mod = await import('./plugins/main/_personalizacion.js')
  initPersonalizacion = mod.default || mod.initPersonalizacion || initPersonalizacion
} catch {
  try {
    const mod = await import('./commands/main/_personalizacion.js')
    initPersonalizacion = mod.default || mod.initPersonalizacion || initPersonalizacion
  } catch {}
}

console.log(chalk.bold.redBright(`\n✰ Iniciando 🤖 Zentury Bot ✰\n`))

cfonts.say('ZENTURY BOT', {
  font: 'block',
  align: 'center',
  colors: ['magentaBright'],
})

cfonts.say(`Developed By • ALAN SHOP`, {
  font: 'console',
  align: 'center',
  colors: ['blueBright'],
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
            : {}),
        }),
      )
    : '')

global.db = new Low(new JSONFile('./lib/storage/databaseSV/database.json'))
global.DATABASE = global.db

global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this)
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
        }
      }, 1000),
    )
  }
  if (global.db.data !== null) return

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
    ...(global.db.data || {}),
  }
  global.db.chain = chain(global.db.data)
}

await global.loadDatabase()

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

const colores = chalk.bgMagenta.white
const opcionQR = chalk.bold.green
const opcionTexto = chalk.bold.cyan

let opcion = null

if (methodCodeQR) opcion = '1'

if (!methodCodeQR && !methodCode && !fs.existsSync(`${SESSIONS_DIR}/creds.json`)) {
  do {
    opcion = await question(
      colores('⌨ Seleccione una opción:\n') +
        opcionQR('1. Con código QR\n') +
        opcionTexto('2. Con código de texto de 8 dígitos\n--> '),
    )
    if (!/^[1-2]$/.test(opcion)) {
      console.log(chalk.bold.redBright(`✦ Solo se permite 1 o 2 (sin letras ni símbolos).`))
    }
  } while (opcion !== '1' && opcion !== '2')
}

console.info = () => {}
console.debug = () => {}

const nameqr = global.nameqr || 'Zentury Bot'

const connectionOptions = {
  logger: pino({ level: 'silent' }),
  printQRInTerminal: opcion === '1' || methodCodeQR,
  mobile: MethodMobile,
  browser:
    opcion === '1' || methodCodeQR
      ? [nameqr, 'Edge', '20.0.04']
      : ['Ubuntu', 'Edge', '110.0.1587.56'],
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
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
  version,
}

global.conn = makeWASocket(connectionOptions)
await initPersonalizacion()

if (!fs.existsSync(`${SESSIONS_DIR}/creds.json`)) {
  if (opcion === '2' || methodCode) {
    opcion = '2'
    if (!global.conn.authState.creds.registered) {
      let phoneNumber = phoneNumberFromConfig

      if (!phoneNumber) {
        do {
          phoneNumber = await question(
            chalk.bgBlack(
              chalk.bold.greenBright(
                `✦ Ingrese el número WhatsApp.\n${chalk.bold.yellowBright(`✏ Ejemplo: 52321xxxxxxx`)}\n${chalk.bold.magentaBright('---> ')}`,
              ),
            ),
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
        console.log(chalk.bold.white(chalk.bgMagenta(`✧ CÓDIGO DE VINCULACIÓN ✧`)), chalk.bold.white(codeBot))
      }, 3000)
    }
  }
}

conn.isInit = false
conn.well = false
global.stopped = 'init'
global.isUpdating = false
global._reloadTimer = null
global._reloadQueue = new Set()

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
    lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode

  if (code && code !== DisconnectReason.loggedOut && global.conn?.ws?.socket == null) {
    await global.reloadHandler(true).catch(console.error)
    global.timestamp.connect = new Date()
  }

  if (global.db.data == null) await global.loadDatabase()

  if ((update.qr && update.qr !== 0) || methodCodeQR) {
    if (opcion === '1' || methodCodeQR) {
      console.log(chalk.bold.yellow(`\n❐ ESCANEA EL CÓDIGO QR (EXPIRA EN 45s)`))
    }
  }

  if (connection === 'open') {
    console.log(chalk.bold.green('\n❀ 🤖 Zentury Bot conectado con éxito ❀'))
  }

  const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

  if (connection === 'close') {
    switch (reason) {
      case DisconnectReason.badSession:
        console.log(chalk.bold.cyanBright(`\n⚠︎ BORRA ${global.sessions} Y ESCANEA EL QR ⚠︎`))
        break
      case DisconnectReason.connectionClosed:
        console.log(chalk.bold.magentaBright(`\n⚠︎ CONEXIÓN CERRADA, RECONECTANDO...`))
        await global.reloadHandler(true).catch(console.error)
        break
      case DisconnectReason.connectionLost:
        console.log(chalk.bold.blueBright(`\n⚠︎ CONEXIÓN PERDIDA, RECONECTANDO...`))
        await global.reloadHandler(true).catch(console.error)
        break
      case DisconnectReason.connectionReplaced:
        console.log(chalk.bold.yellowBright(`\n⚠︎ CONEXIÓN REEMPLAZADA (otra sesión abierta).`))
        break
      case DisconnectReason.loggedOut:
        console.log(chalk.bold.redBright(`\n⚠︎ LOGOUT: BORRA ${global.sessions} Y VUELVE A VINCULAR ⚠︎`))
        break
      case DisconnectReason.restartRequired:
        console.log(chalk.bold.cyanBright(`\n✧ REINICIO REQUERIDO, RECONECTANDO...`))
        await global.reloadHandler(true).catch(console.error)
        break
      case DisconnectReason.timedOut:
        console.log(chalk.bold.yellowBright(`\n⧖ TIMEOUT, RECONECTANDO...`))
        await global.reloadHandler(true).catch(console.error)
        break
      default:
        console.log(chalk.bold.redBright(`\n⚠︎ DESCONEXIÓN DESCONOCIDA: ${reason || 'N/A'} >> ${connection || 'N/A'}`))
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
    try {
      oldConn?.ev?.removeAllListeners()
    } catch {}
    try {
      oldConn?.ws?.close()
    } catch {}
    global.conn = makeWASocket(connectionOptions)
    isInit = true
  }

  const conn = global.conn

  if (!isInit && oldConn?.ev) {
    oldConn.ev.off('messages.upsert', oldConn.handler)
    oldConn.ev.off('groups.update', oldConn.groupsUpdate)
    oldConn.ev.off('connection.update', oldConn.connectionUpdate)
    oldConn.ev.off('creds.update', oldConn.credsUpdate)
    oldConn.ev.off('message.delete', oldConn.onDelete)
  }

  conn.handler = handler.handler.bind(conn)
  conn.groupsUpdate = handler.groupsUpdate.bind(conn)
  conn.onDelete = handler.deleteUpdate.bind(conn)
  conn.connectionUpdate = connectionUpdate.bind(conn)
  conn.credsUpdate = saveCreds

  conn.ev.on('messages.upsert', conn.handler)
  conn.ev.on('groups.update', conn.groupsUpdate)
  conn.ev.on('message.delete', conn.onDelete)
  conn.ev.on('connection.update', conn.connectionUpdate)
  conn.ev.on('creds.update', conn.credsUpdate)

  isInit = false
  return true
}

const pathJadi = join(__dirname, global.jadi)
if (!fs.existsSync(pathJadi)) {
  fs.mkdirSync(pathJadi, { recursive: true })
  console.log(chalk.bold.cyan(`✓ Carpeta '${global.jadi}' creada correctamente.`))
} else {
  console.log(chalk.bold.cyan(`✓ Carpeta '${global.jadi}' ya existe.`))
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

    if (filename in global.plugins) {
      if (fs.existsSync(dir)) global.conn.logger.info(`updated plugin - '${filename}'`)
      else {
        global.conn.logger.warn(`deleted plugin - '${filename}'`)
        delete global.plugins[filename]
        return null
      }
    } else {
      global.conn.logger.info(`new plugin - '${filename}'`)
    }

    const err = syntaxerror(fs.readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    })
    if (err) {
      global.conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`)
      return null
    }

    const fileUrl = pathToFileURL(dir).href
    const module = await import(`${fileUrl}?update=${Date.now()}`)
    global.plugins[name] = module.default || module
    global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
    return module
  } catch (e) {
    global.conn.logger.error(`error loading plugin '${filename}'\n${format(e)}`)
    return null
  }
}

export async function filesInit(folder = 'plugins') {
  const dir = path.join(__dirname, folder)
  global.plugins = global.plugins || {}

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      await filesInit(path.join(folder, file))
    } else if (file.endsWith('.js')) {
      try {
        await global.reload(path.join(folder, file))
      } catch (e) {
        console.error(`🌴 Error cargando ${file}:`, e)
      }
    }
  }
  return global.plugins
}

global.filesInit = filesInit

await filesInit('plugins')
console.log(`🌙 ${Object.keys(global.plugins).length} plugins cargados.`)

Object.freeze(global.reload)

const watcher = chokidar.watch(pluginFolder, {
  ignoreInitial: true,
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/tmp/**',
    '**/*.map',
  ],
  awaitWriteFinish: {
    stabilityThreshold: 350,
    pollInterval: 80,
  },
})

watcher.on('all', async (event, filePath) => {
  try {
    if (global.isUpdating) return
    if (!filePath || !filePath.endsWith('.js')) return

    const rel = path.relative(pluginFolder, filePath).replace(/\\/g, '/')

    global._reloadQueue.add(rel)

    clearTimeout(global._reloadTimer)
    global._reloadTimer = setTimeout(async () => {
      const items = [...global._reloadQueue]
      global._reloadQueue.clear()

      for (const f of items) {
        await global.reload(f)
      }
    }, 250)
  } catch (e) {
    console.error('Watcher error:', e)
  }
})

await global.reloadHandler()

async function _quickTest() {
  const test = await Promise.all(
    [
      spawn('ffmpeg'),
      spawn('ffprobe'),
      spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
      spawn('convert'),
      spawn('magick'),
      spawn('gm'),
      spawn('find', ['--version']),
    ].map((p) =>
      Promise.race([
        new Promise((resolve) => p.on('close', (code) => resolve(code !== 127))),
        new Promise((resolve) => p.on('error', () => resolve(false))),
      ]),
    ),
  )

  const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test
  global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find }
  Object.freeze(global.support)
}

function safeReadDir(dir) {
  try {
    return fs.existsSync(dir) ? fs.readdirSync(dir) : []
  } catch {
    return []
  }
}

function clearTmp() {
  const tmpDir = join(__dirname, 'tmp')
  for (const file of safeReadDir(tmpDir)) {
    try {
      fs.unlinkSync(join(tmpDir, file))
    } catch {}
  }
}

function purgeSession() {
  const files = safeReadDir(SESSIONS_DIR).filter((f) => f.startsWith('pre-key-'))
  for (const f of files) {
    try {
      fs.unlinkSync(`${SESSIONS_DIR}/${f}`)
    } catch {}
  }
}

function purgeSessionSB() {
  try {
    const dirs = safeReadDir(JADI_DIR)
    let total = 0

    for (const d of dirs) {
      const sub = `${JADI_DIR}/${d}`
      if (!fs.existsSync(sub) || !fs.statSync(sub).isDirectory()) continue

      const preKeys = safeReadDir(sub).filter((f) => f.startsWith('pre-key-') && f !== 'creds.json')
      for (const f of preKeys) {
        try {
          fs.unlinkSync(`${sub}/${f}`)
          total++
        } catch {}
      }
    }

    if (total === 0) {
      console.log(chalk.bold.green(`\n╭» ❍ ${global.jadi} ❍\n│→ NADA POR ELIMINAR \n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻︎`))
    } else {
      console.log(chalk.bold.cyanBright(`\n╭» ❍ ${global.jadi} ❍\n│→ ${total} ARCHIVOS NO ESENCIALES ELIMINADOS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻︎︎`))
    }
  } catch (err) {
    console.log(chalk.bold.red(`\n╭» ❍ ${global.jadi} ❍\n│→ OCURRIÓ UN ERROR\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻\n` + err))
  }
}

function purgeOldFiles() {
  const directories = [SESSIONS_DIR, JADI_DIR]

  for (const dir of directories) {
    const files = safeReadDir(dir)
    for (const file of files) {
      if (file === 'creds.json') continue
      const filePath = path.join(dir, file)
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) fs.unlinkSync(filePath)
      } catch {}
    }
  }
}

setInterval(async () => {
  if (global.stopped === 'close' || !global.conn?.user) return
  clearTmp()
  console.log(chalk.bold.cyanBright(`\n╭» ❍ MULTIMEDIA ❍\n│→ TMP limpiado\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`))
}, 1000 * 60 * 4)

setInterval(async () => {
  if (global.stopped === 'close' || !global.conn?.user) return
  console.log(chalk.bold.cyanBright(`\n╭» ❍ ${global.sessions} ❍\n│→ PRE-KEYS eliminadas\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`))
}, 1000 * 60 * 10)

setInterval(async () => {
  if (global.stopped === 'close' || !global.conn?.user) return
}, 1000 * 60 * 10)

setInterval(async () => {
  if (global.stopped === 'close' || !global.conn?.user) return
  console.log(chalk.bold.cyanBright(`\n╭» ❍ ARCHIVOS ❍\n│→ RESIDUALES eliminados\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`))
}, 1000 * 60 * 10)

_quickTest().then(() => global.conn.logger.info(chalk.bold(`✦  H E C H O\n`.trim()))).catch(console.error)

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
