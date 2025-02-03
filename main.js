// Import package
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Token & API key
const token = "7882871404:AAHXMAw6SxL1aT1ZzIAKqsUGcjgsRxj3Vvw";
const OMDB_API_KEY = "418b967";

const bot = new TelegramBot(token, { polling: true });

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
    // Kirim pesan loading
    const loadingMessage = await bot.sendMessage(
      chatId,
      `🔍 Mencari film "${judulFilm}"...`
    );

    // Request ke OMDB API
    const response = await axios.get(
      `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(
        judulFilm
      )}`
    );
    const searchResult = response.data;

    // Hapus pesan loading
    bot.deleteMessage(chatId, loadingMessage.message_id);

    if (searchResult.Response === "True") {
      // Ambil 5 film pertama
      const movies = searchResult.Search.slice(0, 5);

      // Kirim informasi untuk setiap film
      for (const movie of movies) {
        const messageText =
          `🎬 *${movie.Title}* (${movie.Year})\n` +
          `Type: ${movie.Type}\n` +
          `IMDb ID: \`${movie.imdbID}\`\n\n` +
          `Untuk detail lengkap, ketik:\n/detail ${movie.imdbID}`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "📌 Lihat Detail Film",
                callback_data: `detail_${movie.imdbID}`,
              },
            ],
          ],
        };

        if (movie.Poster && movie.Poster !== "N/A") {
          // Kirim poster dengan caption
          await bot.sendPhoto(chatId, movie.Poster, {
            caption: messageText,
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        } else {
          // Jika tidak ada poster, kirim text saja
          await bot.sendMessage(chatId, messageText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        }
      }

      // Kirim total hasil pencarian
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

// Handler untuk callback query (ketika tombol diklik)
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
  
    // Cek jika callback data dimulai dengan 'detail_'
    if (data.startsWith("detail_")) {
      const imdbId = data.split("_")[1];
      
      try {
        // Kirim pesan loading
        const loadingMessage = await bot.sendMessage(
          chatId,
          "🔍 Mengambil detail film..."
        );
  
        // Request detail film ke OMDB API
        const response = await axios.get(
          `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`
        );
        const movie = response.data;
  
        // Hapus pesan loading
        bot.deleteMessage(chatId, loadingMessage.message_id);
  
        if (movie.Response === "True") {
          const movieInfo =
            `🎬 *${movie.Title}* (${movie.Year})\n\n` +
            `📊 *Rating:* ⭐ ${movie.imdbRating}/10\n` +
            `👥 *Votes:* ${movie.imdbVotes}\n` +
            `⏱ *Durasi:* ${movie.Runtime}\n` +
            `🎭 *Genre:* ${movie.Genre}\n` +
            `🌍 *Bahasa:* ${movie.Language}\n` +
            `🎬 *Director:* ${movie.Director}\n` +
            `✍️ *Writers:* ${movie.Writer}\n` +
            `🎭 *Actors:* ${movie.Actors}\n\n` +
            `📝 *Plot:*\n${movie.Plot}\n\n` +
            `🏆 *Awards:* ${movie.Awards}\n` +
            `💰 *Box Office:* ${movie.BoxOffice || "N/A"}\n` +
            `🏢 *Production:* ${movie.Production || "N/A"}\n\n` +
            `🔗 *IMDB:* https://www.imdb.com/title/${movie.imdbID}`;
  
          if (movie.Poster && movie.Poster !== "N/A") {
            // Kirim poster dengan caption
            await bot.sendPhoto(chatId, movie.Poster, {
              caption: movieInfo,
              parse_mode: "Markdown",
            });
          } else {
            // Jika tidak ada poster, kirim text saja
            await bot.sendMessage(chatId, movieInfo, {
              parse_mode: "Markdown",
            });
          }
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
  
    // Hapus loading state dari tombol
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

  try {
    // Kirim pesan loading
    const loadingMessage = await bot.sendMessage(
      chatId,
      "🔍 Mengambil detail film..."
    );

    // Request detail film ke OMDB API
    const response = await axios.get(
      `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`
    );
    const movie = response.data;

    // Hapus pesan loading
    bot.deleteMessage(chatId, loadingMessage.message_id);

    if (movie.Response === "True") {
      const movieInfo =
        `🎬 *${movie.Title}* (${movie.Year})\n\n` +
        `📊 *Rating:* ⭐ ${movie.imdbRating}/10\n` +
        `👥 *Votes:* ${movie.imdbVotes}\n` +
        `⏱ *Durasi:* ${movie.Runtime}\n` +
        `🎭 *Genre:* ${movie.Genre}\n` +
        `🌍 *Bahasa:* ${movie.Language}\n` +
        `🎬 *Director:* ${movie.Director}\n` +
        `✍️ *Writers:* ${movie.Writer}\n` +
        `🎭 *Actors:* ${movie.Actors}\n\n` +
        `📝 *Plot:*\n${movie.Plot}\n\n` +
        `🏆 *Awards:* ${movie.Awards}\n` +
        `💰 *Box Office:* ${movie.BoxOffice || "N/A"}\n` +
        `🏢 *Production:* ${movie.Production || "N/A"}\n\n` +
        `🔗 *IMDB:* https://www.imdb.com/title/${movie.imdbID}`;

      if (movie.Poster && movie.Poster !== "N/A") {
        // Kirim poster dengan caption
        await bot.sendPhoto(chatId, movie.Poster, {
          caption: movieInfo,
          parse_mode: "Markdown",
        });
      } else {
        // Jika tidak ada poster, kirim text saja
        await bot.sendMessage(chatId, movieInfo, {
          parse_mode: "Markdown",
        });
      }
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
});

bot.on("polling_error", (error) => {
  console.error("Error:", error);
});

console.log("CineBot is running! 🎬");
