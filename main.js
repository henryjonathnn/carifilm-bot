// Import package
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Token & API key
const token = "7882871404:AAHXMAw6SxL1aT1ZzIAKqsUGcjgsRxj3Vvw";
const OMDB_API_KEY = "418b967";

// Konstanta untuk batasan Telegram
const MAX_CAPTION_LENGTH = 1024;
const MAX_MESSAGE_LENGTH = 4096;

// Konfigurasi axios yang dioptimalkan
const axiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  httpAgent: new (require('http')).Agent({ keepAlive: true }),
  httpsAgent: new (require('https')).Agent({ keepAlive: true })
});

// Inisialisasi bot dengan opsi yang dioptimalkan
const bot = new TelegramBot(token, {
  polling: true,
  request: {
    connection: {
      keepAlive: true
    }
  }
});

// Cache sederhana
const movieCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 menit

// Fungsi helper untuk mendapatkan data dari cache atau API
async function getMovieData(endpoint, params) {
  const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
  
  if (movieCache.has(cacheKey)) {
    const cachedData = movieCache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    movieCache.delete(cacheKey);
  }

  const response = await axiosInstance.get(endpoint, { params });
  const data = response.data;
  
  movieCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

// Fungsi helper untuk mengirim pesan panjang
async function sendLongMessage(chatId, messageText, options = {}) {
  const maxLength = options.parse_mode ? MAX_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH;
  if (messageText.length <= maxLength) {
    return bot.sendMessage(chatId, messageText, options);
  }

  const messages = [];
  let currentMessage = "";
  const paragraphs = messageText.split('\n\n');

  for (const paragraph of paragraphs) {
    if ((currentMessage + '\n\n' + paragraph).length > maxLength) {
      if (currentMessage) {
        messages.push(currentMessage);
        currentMessage = paragraph;
      } else {
        messages.push(paragraph);
      }
    } else {
      currentMessage = currentMessage ? currentMessage + '\n\n' + paragraph : paragraph;
    }
  }
  if (currentMessage) {
    messages.push(currentMessage);
  }

  // Kirim pesan secara berurutan
  for (const message of messages) {
    await bot.sendMessage(chatId, message, options);
  }
}

// Handler untuk command /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "🎬 Selamat datang di CineBot!\n\n" +
      "Gunakan perintah berikut ini:\n" +
      "1. /cari <judul film> - Mencari informasi film\n" +
      "   Contoh: /cari Inception\n\n" +
      "2. /detail <imdb id> - Melihat detail lengkap film\n" +
      "   Contoh: /detail tt1375666\n\n" +
      "Silakan mulai mencari film! 🍿"
  );
});

// Handler untuk command /cari
bot.onText(/\/cari (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const judulFilm = match[1];

  try {
    const loadingMessage = await bot.sendMessage(
      chatId,
      `🔍 Mencari film "${judulFilm}"...`
    );

    const searchResult = await getMovieData('http://www.omdbapi.com/', {
      apikey: OMDB_API_KEY,
      s: judulFilm
    });

    await bot.deleteMessage(chatId, loadingMessage.message_id);

    if (searchResult.Response === "True") {
      const movies = searchResult.Search.slice(0, 5);
      
      // Menggunakan Promise.all untuk mengirim pesan secara parallel
      await Promise.all(movies.map(async (movie) => {
        const messageText =
          `🎬 *${movie.Title}* (${movie.Year})\n` +
          `Type: ${movie.Type}\n` +
          `IMDb ID: \`${movie.imdbID}\`\n\n` +
          `Untuk detail lengkap, ketik:\n/detail ${movie.imdbID}`;

        const keyboard = {
          inline_keyboard: [[
            {
              text: "📌 Lihat Detail Film",
              callback_data: `detail_${movie.imdbID}`,
            },
          ]],
        };

        try {
          if (movie.Poster && movie.Poster !== "N/A") {
            if (messageText.length <= MAX_CAPTION_LENGTH) {
              await bot.sendPhoto(chatId, movie.Poster, {
                caption: messageText,
                parse_mode: "Markdown",
                reply_markup: keyboard,
              });
            } else {
              // Jika caption terlalu panjang, kirim poster dan pesan terpisah
              await bot.sendPhoto(chatId, movie.Poster);
              await bot.sendMessage(chatId, messageText, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
              });
            }
          } else {
            await bot.sendMessage(chatId, messageText, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
          }
        } catch (error) {
          console.error(`Error sending message for movie ${movie.imdbID}:`, error);
          // Kirim pesan dalam format yang lebih sederhana jika terjadi error
          await bot.sendMessage(chatId, 
            `🎬 ${movie.Title} (${movie.Year})\nIMDb ID: ${movie.imdbID}`
          );
        }
      }));

      await bot.sendMessage(
        chatId,
        `\nDitemukan total ${searchResult.totalResults} hasil.`
      );
    } else {
      await bot.sendMessage(
        chatId,
        `❌ Maaf, tidak ada film dengan judul "${judulFilm}" yang ditemukan.`
      );
    }
  } catch (error) {
    console.error("Error:", error);
    bot.sendMessage(
      chatId,
      "❌ Terjadi kesalahan saat mencari film. Silakan coba lagi nanti."
    );
  }
});

// Handler untuk movie detail (digunakan oleh callback dan command /detail)
async function handleMovieDetail(chatId, imdbId) {
  try {
    const loadingMessage = await bot.sendMessage(
      chatId,
      "🔍 Mengambil detail film..."
    );

    const movie = await getMovieData('http://www.omdbapi.com/', {
      apikey: OMDB_API_KEY,
      i: imdbId,
      plot: 'full'
    });

    await bot.deleteMessage(chatId, loadingMessage.message_id);

    if (movie.Response === "True") {
      const basicInfo =
        `🎬 *${movie.Title}* (${movie.Year})\n\n` +
        `📊 *Rating:* ⭐ ${movie.imdbRating}/10\n` +
        `👥 *Votes:* ${movie.imdbVotes}\n` +
        `⏱ *Durasi:* ${movie.Runtime}\n` +
        `🎭 *Genre:* ${movie.Genre}\n` +
        `🌍 *Bahasa:* ${movie.Language}`;

      const credits =
        `\n\n🎬 *Director:* ${movie.Director}\n` +
        `✍️ *Writers:* ${movie.Writer}\n` +
        `🎭 *Actors:* ${movie.Actors}`;

      const plot = `\n\n📝 *Plot:*\n${movie.Plot}`;

      const additionalInfo =
        `\n\n🏆 *Awards:* ${movie.Awards}\n` +
        `💰 *Box Office:* ${movie.BoxOffice || "N/A"}\n` +
        `🏢 *Production:* ${movie.Production || "N/A"}\n\n` +
        `🔗 *IMDB:* https://www.imdb.com/title/${movie.imdbID}`;

      // Kirim poster jika ada
      if (movie.Poster && movie.Poster !== "N/A") {
        await bot.sendPhoto(chatId, movie.Poster, {
          caption: basicInfo,
          parse_mode: "Markdown"
        });
      } else {
        await bot.sendMessage(chatId, basicInfo, {
          parse_mode: "Markdown"
        });
      }

      // Kirim informasi tambahan dalam pesan terpisah
      await sendLongMessage(chatId, credits + plot + additionalInfo, {
        parse_mode: "Markdown"
      });
    } else {
      await bot.sendMessage(
        chatId,
        "❌ Maaf, film tidak ditemukan. Pastikan IMDB ID sudah benar."
      );
    }
  } catch (error) {
    console.error("Error:", error);
    bot.sendMessage(
      chatId,
      "❌ Terjadi kesalahan saat mengambil detail film. Silakan coba lagi nanti."
    );
  }
}

// Handler untuk callback query
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith("detail_")) {
    const imdbId = data.split("_")[1];
    await handleMovieDetail(chatId, imdbId);
  }

  try {
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (err) {
    console.error("Error answering callback query:", err);
  }
});

// Handler untuk command /detail
bot.onText(/\/detail (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const imdbId = match[1];
  await handleMovieDetail(chatId, imdbId);
});

// Error handler untuk polling
bot.on("polling_error", (error) => {
  console.error("Error:", error);
});

// Error handler global
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

console.log("CineBot is running! 🎬");