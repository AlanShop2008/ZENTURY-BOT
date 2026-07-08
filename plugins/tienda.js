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

    const res = agregarStock(
      m.chat,
      args[0],
      args[1],
      args[2],
      cuentas,
      m.sender
    )

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
      text: `🎉 *COMPRA REALIZADA*

🎬 Producto:
${res.venta.plataforma} ${res.venta.tipo}

📦 Cuenta:
${res.venta.cuenta}

⚠️ No cambies datos de la cuenta.`
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
    const user = m.mentionedJid?.[0]
    const cantidad = Number(args[1])

    if (!user || isNaN(cantidad)) {
      return m.reply('Uso:\n.addsaldo @usuario 200')
    }

    const saldo = registrarSaldo(m.chat, user, cantidad)

    return m.reply(`✅ Saldo agregado.

👤 Usuario:
@${user.split('@')[0]}

💵 Se agregó:
$${cantidad}

💰 Saldo actual:
$${saldo.actual}`, null, { mentions: [user] })
  }

  if (command === 'delsaldo') {
    const user = m.mentionedJid?.[0]
    const cantidad = Number(args[1])

    if (!user || isNaN(cantidad)) {
      return m.reply('Uso:\n.delsaldo @usuario 50')
    }

    const saldo = restarSaldo(m.chat, user, cantidad)

    return m.reply(`✅ Saldo actualizado.

👤 Usuario:
@${user.split('@')[0]}

💰 Saldo actual:
$${saldo.actual}`, null, { mentions: [user] })
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

handler.help = [
  'tienda',
  'addstock',
  'comprar',
  'versaldo',
  'addsaldo',
  'delsaldo',
  'editarprecio'
]

handler.tags = ['tienda']
handler.command = /^(tienda|addstock|comprar|versaldo|addsaldo|delsaldo|editarprecio)$/i

export default handler
