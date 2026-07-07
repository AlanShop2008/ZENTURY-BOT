const store = {
  chats: {},
  messages: {},

  bind(ev) {
    return true
  },

  loadMessage(jid, id) {
    return this.messages?.[jid]?.[id] || null
  },

  readFromFile() {
    return true
  },

  writeToFile() {
    return true
  }
}

export default store
