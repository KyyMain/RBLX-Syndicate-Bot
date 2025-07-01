// commands/addstock.js
const { PermissionsBitField } = require("discord.js");
const fs = require("fs");

module.exports = async (message, args) => {
  // Check if message is in a guild (not DM)
  if (!message.guild) {
    return message.reply(
      "❌ Command ini hanya bisa digunakan di server, bukan di DM."
    );
  }

  // Check if member exists and has admin permissions
  if (
    !message.member ||
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    return message.reply("❌ Hanya admin yang bisa menambah stok.");
  }

  const [itemKey, itemName, priceStr, stockStr] = args;
  const price = parseInt(priceStr);
  const stock = parseInt(stockStr);

  if (!itemKey || !itemName || isNaN(price) || isNaN(stock)) {
    return message.reply(
      "❌ Format salah!\n" +
        '**Contoh:** `!addstock pet_dragon "Pet Dragon" 75000 50`\n' +
        "**Format:** `!addstock [key] [nama] [harga] [stok]`"
    );
  }

  // Clear cache dan ambil data items yang fresh
  delete require.cache[require.resolve("../data/items.json")];
  const items = require("../data/items.json");

  // Cek apakah item sudah ada
  if (items[itemKey]) {
    return message.reply(
      `❌ Item dengan key \`${itemKey}\` sudah ada! Gunakan \`!editstock\` untuk mengubah stok.`
    );
  }

  // Tambah item baru
  items[itemKey] = {
    name: itemName,
    price: price,
    stock: stock,
  };

  try {
    fs.writeFileSync("./data/items.json", JSON.stringify(items, null, 2));
    message.reply(
      `✅ **Item baru berhasil ditambahkan!**\n\n` +
        `🔑 **Key:** \`${itemKey}\`\n` +
        `📦 **Nama:** ${itemName}\n` +
        `💰 **Harga:** Rp${price.toLocaleString()}\n` +
        `📊 **Stok:** ${stock}`
    );
  } catch (error) {
    console.error("Error saving items:", error);
    message.reply("❌ Gagal menyimpan item baru.");
  }
};
