const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const config = require("../config.json");
const items = require("../data/items.json");

module.exports = async (interaction) => {
  const [_, itemKey, jumlahStr, userId, method] =
    interaction.customId.split("_");
  const jumlah = parseInt(jumlahStr);
  const item = items[itemKey];

  await interaction.update({
    content:
      "✅ Silakan upload bukti transfer kamu (gambar) di bawah pesan ini.",
    components: [],
  });

  const filter = (m) =>
    m.author.id === interaction.user.id && m.attachments.size > 0;
  const collector = interaction.channel.createMessageCollector({
    filter,
    time: 60000,
    max: 1,
  });

  collector.on("collect", async (msg) => {
    const attachment = msg.attachments.first();
    const proofEmbed = {
      title: "📥 Bukti Pembayaran Diterima",
      description: `👤 Pembeli: <@${userId}>
📦 ${item.name} x${jumlah}
💳 Metode: ${method}`,
      image: { url: attachment.url },
      color: 0xffcc00,
    };

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin_paid_${itemKey}_${jumlah}_${userId}_${method}`)
        .setLabel("✅ Pembayaran Berhasil")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.client.channels.cache.get(config.adminChannelId).send({
      embeds: [proofEmbed],
      components: [confirmRow],
    });

    await msg.reply(
      "✅ Bukti pembayaran berhasil dikirim ke admin. Mohon tunggu konfirmasi."
    );
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      interaction.followUp({
        content: "❌ Waktu upload bukti habis. Silakan ulangi perintah.",
        ephemeral: true,
      });
    }
  });
};
