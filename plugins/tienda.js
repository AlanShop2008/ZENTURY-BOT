import {
  agregarStock,
  generarTienda,
  comprarProducto,
  editarPrecio,
  registrarSaldo,
  restarSaldo,
  verSaldo
} from '../lib/tienda.js'

import { prepararImportacion } from '../lib/importador.js'
import { listarGrupos } from '../lib/grupos.js'

function obtenerUsuario(m, args = []) {
  if (m.mentionedJid && m.mentionedJid.length) return m.mentionedJid[0]

  const mencionado = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
  if (mencionado) return mencionado

  const posibleNumero = args.find(a => {
    const limpio = String(a).replace(/[^0-9]/g, '')
    return limpio.length >= 10 && !String(a).startsWith('@')
  })

  if (posibleNumero) return posibleNumero.replace(/[^0-9]/g, '') + '@s.whatsapp.net'

  return null
}

function obtenerCantidad(args = []) {
  const ultimo = args[args.length - 1]
  if (!ultimo) return NaN

  const limpio = String(ultimo).replace(/[^0-9.]/g, '')
  return limpio ? Number(limpio) : NaN
}

function obtenerGrupoPorNumero(valor) {
  if (!/^\d+$/.test(String(valor))) return null

  const grupos = listarGrupos()
  const index = Number(valor) - 1

  return grupos[index] || null
}

function limpiarNumero(jid = '') {
  return String(jid || '').replace(/[^0-9]/g, '')
}

async function resolverPrivado(conn, m) {
  const posibles = [
    m.key?.participant,
    m.participant,
    m.sender,
    m.from
  ].filter(Boolean)

  for (const jid of posibles) {
    const texto = String(jid)

    if (texto.endsWith('@s.whatsapp.net')) return texto

    if (texto.endsWith('@lid')) {
      try {
        const meta = m.isGroup ? await conn.groupMetadata(m.chat).catch(() => null) : null
        const participantes = meta?.participants || []

        const encontrado = participantes.find(p =>
          p.id === texto ||
          p.jid === texto ||
          p.lid === texto ||
          p.phoneNumber === texto
        )

        const real =
          encontrado?.jid ||
          encontrado?.phoneNumber ||
          encontrado?.id

        if (real && String(real).endsWith('@s.whatsapp.net')) return real

        const numero = limpiarNumero(real || '')
        if (numero.length >= 10) return `${numero}@s.whatsapp.net`
      } catch {}
    }

    const numero = limpiarNumero(texto)
    if (numero.length >= 10 && !texto.endsWith('@g.us')) {
      return `${numero}@s.whatsapp.net`
    }
  }

  return m.sender
}

const handler = async (m, { conn, command, args }) => {
  if (command === 'grupos') {
    const grupos = listarGrupos()

    if (!grupos.length) {
      return m.reply('❌ No hay grupos registrados todavía.')
    }

    let texto = `📋 *GRUPOS ZENTURY BOT*

`

    grupos.forEach((g, i) => {
      texto += `${i + 1}️⃣ *${g.nombre || 'Grupo sin nombre'}*
🆔 ${g.id}

`
    })

    texto += `━━━━━━━━━━━━━━━━

Para cargar stock por privado:

.addstock NUMERO netflix perfil 35

Ejemplo:
.addstock 3 netflix perfil 35`

    return m.reply(texto)
  }

  if (command === 'tienda') {
    return m.reply(generarTienda(m.chat))
  }

  if (command === 'addstock') {
    if (m.isGroup) {
      return m.reply('❌ Este comando solo se usa por privado con el bot.')
    }

    if (args.length < 4) {
      return m.reply(`Uso:
.addstock NUMERO netflix perfil 35
.addstock ID_GRUPO netflix perfil 35

Primero usa:
.grupos`)
    }

    let groupId = args[0]
    const grupoPorNumero = obtenerGrupoPorNumero(groupId)

    if (grupoPorNumero) {
      groupId = grupoPorNumero.id
    }

    const plataforma = args[1]
    const tipo = args[2]
    const precio = args[3]

    if (!String(groupId).endsWith('@g.us')) {
      return m.reply(`❌ Grupo inválido.

Usa:
.grupos

Luego:
.addstock NUMERO netflix perfil 35`)
    }

    const q = m.quoted
    if (!q) return m.reply('Responde a un mensaje o TXT con las cuentas.')

    let texto = ''

    if (q.text) texto = q.text
    else {
      const buffer = await q.download()
      texto = buffer.toString()
    }

    const cuentas = prepararImportacion(texto)
    if (!cuentas.length) return m.reply('❌ No detecté cuentas para agregar.')

    const res = agregarStock(groupId, plataforma, tipo, precio, cuentas, m.sender)

    const nombreGrupo = grupoPorNumero?.nombre || groupId

    return m.reply(`📦 *STOCK CARGADO*

👥 Grupo:
${nombreGrupo}

🆔 ID:
${groupId}

🎬 Plataforma:
${plataforma}

📂 Tipo:
${tipo}

💵 Precio:
$${precio}

✅ Agregadas:
${res.agregadas}

⚠️ Duplicadas:
${res.duplicadas}

📦 Disponibles:
${res.total}`)
  }

  if (command === 'comprar') {
    if (args.length < 2) return m.reply('Uso:\n.comprar netflix perfil')

    const res = comprarProducto(m.chat, m.sender, args[0], args[1])

    if (!res.ok) {
      if (res.motivo === 'producto_no_existe') return m.reply('❌ Producto no disponible.')
      if (res.motivo === 'sin_stock') return m.reply('❌ Sin stock disponible.')
      if (res.motivo === 'saldo_insuficiente') {
        return m.reply(`❌ Saldo insuficiente.

💵 Precio: $${res.precio}
💰 Tu saldo: $${res.saldo}`)
      }

      return m.reply('❌ No se pudo realizar la compra.')
    }

    const destinoPrivado = await resolverPrivado(conn, m)

    let enviadoPrivado = false

    try {
      await conn.sendMessage(destinoPrivado, {
        text: `╔════════════════════╗
        🛒 ALAN SHOP
       ZENTURY BOT
╚════════════════════╝

✅ *COMPRA EXITOSA*

━━━━━━━━━━━━━━━━━━

🎬 *Producto:*
${res.venta.plataforma} • ${res.venta.tipo}

📦 *Cuenta entregada:*
${res.venta.cuenta}

━━━━━━━━━━━━━━━━━━

💵 *Precio:*
$${res.venta.precio}

💰 *Saldo restante:*
$${res.saldoRestante}

📅 *Fecha:*
${new Date().toLocaleString('es-MX')}

━━━━━━━━━━━━━━━━━━

⚠️ *IMPORTANTE*

• No cambies correo.
• No cambies contraseña.
• No elimines perfiles.
• El incumplimiento anula garantía.

━━━━━━━━━━━━━━━━━━

🤖 Entrega automática por *ZENTURY BOT*`
      })

      enviadoPrivado = true
    } catch (e) {
      console.log('ERROR ENVIANDO PRIVADO:', e)
    }

    if (!enviadoPrivado) {
      return m.reply(`⚠️ Compra procesada, pero no pude enviarte privado.

Abre chat conmigo primero y mándame:
.hola`)
    }

    return m.reply(`✅ Compra realizada.

📩 La cuenta fue enviada por privado.

💰 Saldo restante:
$${res.saldoRestante}`)
  }

  if (command === 'versaldo') {
    const saldo = verSaldo(m.chat, m.sender)
    return m.reply(`💰 Tu saldo actual es: *$${saldo}*`)
  }

  if (command === 'addsaldo') {
    const user = obtenerUsuario(m, args)
    const cantidad = obtenerCantidad(args)

    if (!user || isNaN(cantidad)) {
      return m.reply(`Uso:
.addsaldo @cliente 200
.addsaldo 5217715555998 200`)
    }

    const saldo = registrarSaldo(m.chat, user, cantidad)

    return conn.sendMessage(m.chat, {
      text: `✅ Saldo agregado.

👤 Usuario:
@${user.split('@')[0]}

💵 Se agregó:
$${cantidad}

💰 Saldo actual:
$${saldo.actual}`,
      mentions: [user]
    }, { quoted: m })
  }

  if (command === 'delsaldo') {
    const user = obtenerUsuario(m, args)
    const cantidad = obtenerCantidad(args)

    if (!user || isNaN(cantidad)) {
      return m.reply(`Uso:
.delsaldo @cliente 50
.delsaldo 5217715555998 50`)
    }

    const saldo = restarSaldo(m.chat, user, cantidad)

    return conn.sendMessage(m.chat, {
      text: `✅ Saldo actualizado.

👤 Usuario:
@${user.split('@')[0]}

💵 Se restó:
$${cantidad}

💰 Saldo actual:
$${saldo.actual}`,
      mentions: [user]
    }, { quoted: m })
  }

  if (command === 'editarprecio') {
    if (args.length < 3) return m.reply('Uso:\n.editarprecio netflix perfil 40')

    const producto = editarPrecio(m.chat, args[0], args[1], args[2])
    if (!producto) return m.reply('❌ Ese producto no existe.')

    return m.reply(`✅ Precio actualizado.

🎬 ${args[0]} ${args[1]}
💵 Nuevo precio: $${args[2]}`)
  }
}

handler.help = ['grupos', 'tienda', 'addstock', 'comprar', 'versaldo', 'addsaldo', 'delsaldo', 'editarprecio']
handler.tags = ['tienda']
handler.command = /^(grupos|tienda|addstock|comprar|versaldo|addsaldo|delsaldo|editarprecio)$/i

export default handler
