import fetch from 'node-fetch'
import yts from 'yt-search'

if (!global.playSessions) global.playSessions = new Map()

const apiKey = 'barboza'
const SESSION_TIME = 5 * 60 * 1000

function cleanFileName(name) {
  return (name || 'YouTube')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 80)
}

function limpiarTitulo(title = '') {
  return String(title || '')
    .replace(/\(.*?official.*?\)/gi, '')
    .replace(/\[.*?official.*?\]/gi, '')
    .replace(/\(.*?video.*?\)/gi, '')
    .replace(/\[.*?video.*?\]/gi, '')
    .replace(/\(.*?lyrics.*?\)/gi, '')
    .replace(/\[.*?lyrics.*?\]/gi, '')
    .replace(/\(.*?letra.*?\)/gi, '')
    .replace(/\[.*?letra.*?\]/gi, '')
    .replace(/\bofficial audio\b/gi, '')
    .replace(/\baudio oficial\b/gi, '')
    .replace(/\bofficial video\b/gi, '')
    .replace(/\bvideo oficial\b/gi, '')
    .replace(/\blyrics\b/gi, '')
    .replace(/\bletra\b/gi, '')
    .replace(/\blive\b/gi, '')
    .replace(/\ben vivo\b/gi, '')
    .replace(/\bHD\b/gi, '')
    .replace(/\b4K\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tituloMalo(title = '') {
  const t = String(title || '').toLowerCase()
  const malos = [
    'live',
    'en vivo',
    'karaoke',
    'cover',
    'reaction',
    'reaccion',
    'remix',
    'sped up',
    'nightcore',
    'instrumental',
    'tutorial',
    'concierto',
    'entrevista'
  ]
  return malos.some(x => t.includes(x))
}

function getBody(m) {
  return (
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    ''
  ).trim()
}

function getSessionKey(m) {
  return `${m.chat}:${m.sender || m.from || m.chat}`
}

function esLinkYoutube(input = '') {
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/.test(input)
}

function obtenerVideoId(input = '') {
  const ytRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/
  const match = input.match(ytRegex)
  return match ? match[1] : null
}

async function buscarPorLink(input) {
  const videoId = obtenerVideoId(input)
  if (!videoId) return null

  const info = await yts({ videoId }).catch(() => null)

  return {
    title: limpiarTitulo(info?.title || 'Video de YouTube'),
    originalTitle: info?.title || 'Video de YouTube',
    url: info?.url || `https://youtu.be/${videoId}`,
    videoId,
    thumbnail: info?.thumbnail || info?.image || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: info?.timestamp || 'Desconocida',
    author: info?.author?.name || info?.author || 'Desconocido'
  }
}

async function buscarResultados(input) {
  if (esLinkYoutube(input)) {
    const video = await buscarPorLink(input)
    return video ? [video] : []
  }

  const query = `${input} audio`
  const search = await yts(query)
  let videos = search.videos || []

  videos = videos
    .filter(v => v && v.url && v.videoId)
    .filter(v => !tituloMalo(v.title))
    .slice(0, 8)

  if (videos.length < 5) {
    const search2 = await yts(input)
    const extra = (search2.videos || [])
      .filter(v => v && v.url && v.videoId)
      .filter(v => !tituloMalo(v.title))

    for (const v of extra) {
      if (!videos.find(x => x.videoId === v.videoId)) videos.push(v)
      if (videos.length >= 5) break
    }
  }

  return videos.slice(0, 5).map(v => ({
    title: limpiarTitulo(v.title),
    originalTitle: v.title,
    url: v.url,
    videoId: v.videoId,
    thumbnail: v.thumbnail || v.image || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    duration: v.timestamp || 'Desconocida',
    author: v.author?.name || v.author || 'Desconocido'
  }))
}

async function downloadYoutube(url, format) {
  const apiUrl = `https://getmod-mediahub.vercel.app/api/ytdl?url=${encodeURIComponent(url)}&format=${format}&apikey=${apiKey}`
  const res = await fetch(apiUrl)

  if (!res.ok) throw new Error('La API no respondió correctamente.')

  const json = await res.json()

  if (!json.status || !json.dl) {
    throw new Error('No se pudo obtener el archivo.')
  }

  return json
}

function menuResultados(resultados) {
  let txt = `╭━━━〔 🎵 *YOUTUBE PLAY* 〕━━━╮\n┃\n┃ Elige la canción correcta:\n┃\n`

  resultados.forEach((v, i) => {
    txt += `┃ ${i + 1}. ${v.title}\n┃    👤 ${v.author}\n┃    ⏱️ ${v.duration}\n┃\n`
  })

  txt += `╰━━━━━━━━━━━━━━━━━━━━╯\n\nResponde con un número del *1 al ${resultados.length}*.\n\n⏳ Esta búsqueda vence en 5 minutos.`
  return txt
}

function menuFormato(video) {
  return `╭━━━〔 🎵 *YOUTUBE PLAY* 〕━━━╮
┃
┃ 📌 *Título:* ${video.title}
┃ 👤 *Artista/Canal:* ${video.author}
┃ ⏱️ *Duración:* ${video.duration}
┃
╰━━━━━━━━━━━━━━━━━━━━╯

Ahora elige formato:

1️⃣ Audio
2️⃣ MP3 archivo
3️⃣ Video

Responde con *1*, *2* o *3*.

⏳ Este menú vence en 5 minutos.`
}

const handler = async (m, { conn, text }) => {
  try {
    const input = (text || '').trim()

    if (!input) {
      return conn.reply(m.chat, `🎵 Ingresa el nombre o link de YouTube.\n\nEjemplo:\n.play Belanova Rosa Pastel`, m)
    }

    await m.react('🔎')

    const resultados = await buscarResultados(input)

    if (!resultados.length) {
      await m.react('✖️')
      return conn.reply(m.chat, '❌ No se encontraron resultados.', m)
    }

    const key = getSessionKey(m)

    if (resultados.length === 1) {
      global.playSessions.set(key, {
        step: 'format',
        video: resultados[0],
        time: Date.now()
      })

      await conn.sendMessage(
        m.chat,
        {
          image: { url: resultados[0].thumbnail },
          caption: menuFormato(resultados[0])
        },
        { quoted: m }
      )

      await m.react('✔️')
      return
    }

    global.playSessions.set(key, {
      step: 'select',
      resultados,
      time: Date.now()
    })

    await conn.sendMessage(
      m.chat,
      {
        image: { url: resultados[0].thumbnail },
        caption: menuResultados(resultados)
      },
      { quoted: m }
    )

    await m.react('✔️')
  } catch (e) {
    console.error(e)
    await m.react('✖️')
    return conn.reply(m.chat, `⚠️ Error: ${e.message || e}`, m)
  }
}

handler.before = async (m, { conn }) => {
  try {
    const body = getBody(m)
    if (!/^[1-5]$/.test(body)) return

    const key = getSessionKey(m)
    const session = global.playSessions.get(key)

    if (!session) return

    const expired = Date.now() - session.time > SESSION_TIME
    if (expired) {
      global.playSessions.delete(key)
      return conn.reply(m.chat, `⚠️ El menú de play ya expiró.\n\nVuelve a buscar con:\n.play nombre de la canción`, m)
    }

    if (session.step === 'select') {
      const index = Number(body) - 1
      const video = session.resultados[index]

      if (!video) return

      global.playSessions.set(key, {
        step: 'format',
        video,
        time: Date.now()
      })

      await m.react('✅')

      await conn.sendMessage(
        m.chat,
        {
          image: { url: video.thumbnail },
          caption: menuFormato(video)
        },
        { quoted: m }
      )

      return true
    }

    if (session.step === 'format') {
      if (!['1', '2', '3'].includes(body)) return

      await m.react('⏳')

      const video = session.video
      const format = body === '3' ? 'mp4' : 'mp3'
      const json = await downloadYoutube(video.url, format)
      const title = cleanFileName(limpiarTitulo(json.title || video.title))

      if (body === '1') {
        await conn.sendMessage(
          m.chat,
          {
            audio: { url: json.dl },
            fileName: `${title}.mp3`,
            mimetype: 'audio/mpeg'
          },
          { quoted: m }
        )
      }

      if (body === '2') {
        await conn.sendMessage(
          m.chat,
          {
            document: { url: json.dl },
            fileName: `${title}.mp3`,
            mimetype: 'audio/mpeg'
          },
          { quoted: m }
        )
      }

      if (body === '3') {
        await conn.sendMessage(
          m.chat,
          {
            video: { url: json.dl },
            caption: `🎬 ${title}`,
            fileName: `${title}.mp4`,
            mimetype: 'video/mp4'
          },
          { quoted: m }
        )
      }

      global.playSessions.delete(key)
      await m.react('✔️')
      return true
    }
  } catch (e) {
    console.error(e)
    await m.react('✖️')
    return conn.reply(m.chat, `⚠️ Error: ${e.message || e}`, m)
  }
}

handler.command = /^(play)$/i
handler.help = ['play <texto/link>']
handler.tags = ['media']

export default handler
