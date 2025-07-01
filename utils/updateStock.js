const { EmbedBuilder } = require("discord.js");
const fs = require("fs");

module.exports = async (interaction) => {
  const [_, itemKey, jumlahStr, userId] = interaction.customId.split("_");
  const jumlah = parseInt(jumlahStr);

  // Clear cache dan ambil data items yang fresh
  delete require.cache[require.resolve("../data/items.json")];
  const items = require("../data/items.json");

  const item = items[itemKey];

  if (!item || item.stock < jumlah) {
    return interaction.reply({
      content: "❌ Stok habis atau tidak cukup.",
      ephemeral: true,
    });
  }

  item.stock -= jumlah;
  fs.writeFileSync("./data/items.json", JSON.stringify(items, null, 2));

  // Clear cache dan ambil data transactions yang fresh
  delete require.cache[require.resolve("../data/transactions.json")];
  let transactions = require("../data/transactions.json");

  transactions.push({
    user: userId,
    item: item.name,
    amount: jumlah,
    time: new Date().toISOString(),
  });
  fs.writeFileSync(
    "./data/transactions.json",
    JSON.stringify(transactions, null, 2)
  );

  const embed = new EmbedBuilder()
    .setTitle("✅ TRANSAKSI BERHASIL!")
    .setColor(0x00cc99)
    .setDescription(
      `**📦 Oleh:** <@${userId}>\n**⚙️ Sistem:** Direct\n**💳 Payment:** Trade\n**🐣 Jenis:** ${item.name}\n**🔢 Jumlah:** ${jumlah}\n**🎮 Game:** Grow A Garden`
    )
    .addFields(
      {
        name: "📸 Instagram",
        value: "[kyy.store._](https://instagram.com/kyy.store._)",
        inline: true,
      },
      {
        name: "🎵 TikTok",
        value: "[@partofme._](https://www.tiktok.com/@partofme._)",
        inline: true,
      }
    )
    .setFooter({ text: "Terima kasih telah order di RBLX Syndicate 💖" });

  await interaction.update({
    content: "✅ Transaksi dikonfirmasi!",
    components: [],
  });
  await interaction.channel.send({ embeds: [embed] });
};
