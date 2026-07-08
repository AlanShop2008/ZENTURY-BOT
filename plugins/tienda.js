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

const handler = async (m, { conn, command, args }) => {
  if (command === 'tienda') {
    return m.reply(generarTienda(m.chat))
  }

  if (command === 'addstock') {
    if (args.length < 3) return m.reply('Uso:\n.addstock netflix perfil 35')

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

    const res = agregarStock(m.chat, args[0], args[1], args[2], cuentas, m.sender)

    return m.reply(`📦 *STOCK CARGADO*

🎬 Plataforma:
${args[0]}

📂 Tipo:
${args[1]}

💵 Precio:
$${args[2]}

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

    await conn.sendMessage(m.sender, {
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
    }).catch(() => {})

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

handler.help = ['tienda', 'addstock', 'comprar', 'versaldo', 'addsaldo', 'delsaldo', 'editarprecio']
handler.tags = ['tienda']
handler.command = /^(tienda|addstock|comprar|versaldo|addsaldo|delsaldo|editarprecio)$/i

export default handler
