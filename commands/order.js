// commands/order.js
const selectPayment = require("../utils/selectPayment");

module.exports = async (message, args) => {
  const [itemKey, jumlahStr] = args;
  const jumlah = parseInt(jumlahStr);

  if (!itemKey || isNaN(jumlah))
    return message.reply("Format salah. Contoh: `!order pet_ostrich 2`");

  // Clear cache dan ambil data items yang fresh
  delete require.cache[require.resolve("../data/items.json")];
  const items = require("../data/items.json");

  const item = items[itemKey];

  if (!item)
    return message.reply("Item tidak ditemukan. Coba cek `!pricelist`.");
  if (item.stock < jumlah)
    return message.reply(`Stok tidak cukup! Sisa stok: ${item.stock}`);

  // Kirim pilihan metode pembayaran via DM
  await selectPayment(message, itemKey, jumlah);
};
