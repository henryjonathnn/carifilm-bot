const TelegramBot = require('node-telegram-bot-api')

const token = '7882871404:AAHXMAw6SxL1aT1ZzIAKqsUGcjgsRxj3Vvw'

const bot = new TelegramBot(token, { polling: true })

console.log('Bot is running...')

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, "Bot berhasil jalan! ✅")
})

bot.on('polling_error', (error) => {
    console.error('Error:', error);
});