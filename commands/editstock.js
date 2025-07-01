const fs = require("fs");
const items = require("../data/items.json");
const { PermissionsBitField } = require("discord.js");

module.exports = async (message, args) => {
  const [itemKey, jumlahStr] = args;
  const jumlah = parseInt(jumlahStr);

  if (
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    return message.reply("❌ Hanya admin yang bisa mengedit stok.");
  }

  if (!itemKey || isNaN(jumlah))
    return message.reply("Contoh: `!editstock pet_ostrich 20`");
  if (!items[itemKey]) return message.reply("Item tidak ditemukan.");

  items[itemKey].stock = jumlah;
  fs.writeFileSync("./data/items.json", JSON.stringify(items, null, 2));
  message.reply(`Stok untuk ${items[itemKey].name} diubah menjadi ${jumlah}`);
};
