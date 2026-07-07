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

const handler = async (m, { conn, command, args, text }) => {

  // =====================
  // TIENDA
  // =====================

  if (command === 'tienda') {
    return m.reply(generarTienda(m.chat))
  }

  // =====================
  // VER SALDO
  // =====================

  if (command === 'versaldo') {
    const saldo = verSaldo(m.chat, m.sender)
    return m.reply(`💰 Tu saldo es: *$${saldo}*`)
  }

  // =====================
  // AGREGAR SALDO
  // =====================

  if (command === 'addsaldo') {

    let usuario = m.mentionedJid?.[0]

    if (!usuario)
      return m.reply('Etiqueta al usuario.')

    const cantidad = Number(args[1])

    if (isNaN(cantidad))
      return m.reply('Cantidad inválida.')

    const saldo = registrarSaldo(m.chat, usuario, cantidad)

    return m.reply(`✅ Saldo agregado

Usuario:
@${usuario.split('@')[0]}

Anterior:
$${saldo.anterior}

Actual:
$${saldo.actual}`, {
      mentions:[usuario]
    })

  }

  // =====================
  // RESTAR SALDO
  // =====================

  if (command === 'delsaldo') {

    let usuario = m.mentionedJid?.[0]

    if (!usuario)
      return m.reply('Etiqueta al usuario.')

    const cantidad = Number(args[1])

    if (isNaN(cantidad))
      return m.reply('Cantidad inválida.')

    const saldo = restarSaldo(m.chat, usuario, cantidad)

    return m.reply(`✅ Saldo actualizado

Usuario:
@${usuario.split('@')[0]}

Saldo:
$${saldo.actual}`, {
      mentions:[usuario]
    })

  }

  // =====================
  // EDITAR PRECIO
  // =====================

  if (command === 'editarprecio') {

    if(args.length < 3)
      return m.reply('.editarprecio netflix perfil 35')

    const plataforma=args[0]
    const tipo=args[1]
    const precio=args[2]

    editarPrecio(m.chat,plataforma,tipo,precio)

    return m.reply('✅ Precio actualizado.')

  }

  // =====================
  // COMPRAR
  // =====================

  if(command==='comprar'){

      if(args.length<2)
      return m.reply('.comprar netflix perfil')

      const venta=comprarProducto(
        m.chat,
        m.sender,
        args[0],
        args[1]
      )

      if(!venta.ok){

          if(venta.motivo==='sin_stock')
          return m.reply('❌ Sin stock.')

          if(venta.motivo==='saldo_insuficiente')
          return m.reply(`Saldo insuficiente.

Necesitas:

$${venta.precio}

Tienes:

$${venta.saldo}`)

          return m.reply('No disponible.')

      }

      await conn.sendMessage(m.sender,{
          text:`🎉 Compra realizada

${venta.venta.cuenta}

Gracias por comprar en Zentury Bot.`
      })

      return m.reply(`✅ Cuenta enviada por privado.

Saldo restante:

$${venta.saldoRestante}`)

  }

  // =====================
  // ADDSTOCK
  // =====================

  if(command==='addstock'){

      if(args.length<3)
      return m.reply('.addstock netflix perfil 35')

      const q=m.quoted

      if(!q)
      return m.reply('Responde un TXT o mensaje con las cuentas.')

      let texto=''

      if(q.text){

          texto=q.text

      }else{

          const buffer=await q.download()

          texto=buffer.toString()

      }

      const cuentas=prepararImportacion(texto)

      const res=agregarStock(
          m.chat,
          args[0],
          args[1],
          args[2],
          cuentas,
          m.sender
      )

      return m.reply(`📦 STOCK CARGADO

Plataforma:

${args[0]}

Tipo:

${args[1]}

Precio:

$${args[2]}

Agregadas:

${res.agregadas}

Duplicadas:

${res.duplicadas}

Disponibles:

${res.total}`)

  }

}

handler.help=[
'addstock',
'tienda',
'comprar',
'editarprecio',
'versaldo',
'addsaldo',
'delsaldo'
]

handler.tags=['tienda']

handler.command=/^(addstock|tienda|comprar|editarprecio|versaldo|addsaldo|delsaldo)$/i

export default handler
