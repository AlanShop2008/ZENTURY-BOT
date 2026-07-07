import { makeInMemoryStore } from '@whiskeysockets/baileys'
import pino from 'pino'

const store = makeInMemoryStore({
  logger: pino({ level: 'silent' })
})

store.readFromFile('./sessions/store.json')

setInterval(() => {
  store.writeToFile('./sessions/store.json')
}, 10_000)

export default store
