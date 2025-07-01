const { EmbedBuilder } = require("discord.js");

module.exports = async (message) => {
  // Clear cache dan ambil data items yang fresh
  delete require.cache[require.resolve("../data/items.json")];
  const items = require("../data/items.json");

  const list = Object.entries(items)
    .map(
      ([key, val]) =>
        `🔹 **${val.name}**\nHarga: Rp${val.price.toLocaleString()} | Stok: ${
          val.stock
        }`
    )
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle("📋 Daftar Harga & Stok")
    .setDescription(list)
    .setColor(0x00cc99);

  message.channel.send({ embeds: [embed] });
};
