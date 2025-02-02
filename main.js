const TelegramBot = require('node-telegram-bot-api')

const token = '' // masih kosong

const bot = new TelegramBot(token, { polling: true })

console.log('Bot is running...')
