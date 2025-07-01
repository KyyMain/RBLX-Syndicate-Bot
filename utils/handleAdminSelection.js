// utils/handleAdminSelection.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { getActiveAdmins } = require("./adminHelper");

module.exports = async (interaction) => {
  try {
    const [_, __, itemKey, jumlahStr, adminId] =
      interaction.customId.split("_");
    const jumlah = parseInt(jumlahStr);

    // Clear cache dan ambil data items yang fresh
    delete require.cache[require.resolve("../data/items.json")];
    const items = require("../data/items.json");

    const item = items[itemKey];
    const totalPrice = item.price * jumlah;

    // Ambil data admin yang dipilih
    const activeAdmins = getActiveAdmins();
    const selectedAdmin = activeAdmins[adminId];

    if (!selectedAdmin) {
      return interaction.reply({
        content: "❌ Admin yang dipilih tidak aktif lagi.",
        ephemeral: true,
      });
    }

    // Tampilkan metode pembayaran untuk admin yang dipilih
    const config = require("../config.json");

    const embed = new EmbedBuilder()
      .setTitle("💳 Pilih Metode Pembayaran")
      .setDescription(
        `**📦 Item:** ${item.name}\n` +
          `**🔢 Jumlah:** ${jumlah}\n` +
          `**💰 Total:** Rp${totalPrice.toLocaleString()}\n` +
          `**👤 Admin:** ${selectedAdmin.name}\n\n` +
          `Pilih metode pembayaran:`
      )
      .setColor(0x3399ff)
      .setTimestamp();

    const buttons = [];
    const availablePayments = selectedAdmin.payments || [
      "QRIS",
      "DANA",
      "OVO",
      "GOJEK",
    ];

    // Buat button untuk setiap metode pembayaran yang tersedia
    for (let i = 0; i < availablePayments.length; i += 4) {
      const row = new ActionRowBuilder();
      const rowPayments = availablePayments.slice(i, i + 4);

      for (const paymentMethod of rowPayments) {
        if (config.payments[paymentMethod]) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `pay_${paymentMethod}_${itemKey}_${jumlah}_${interaction.user.id}_${adminId}`
              )
              .setLabel(paymentMethod)
              .setStyle(ButtonStyle.Success)
              .setEmoji("💳")
          );
        }
      }

      if (row.components.length > 0) {
        buttons.push(row);
      }
    }

    // Tambah button back dan cancel
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`back_admin_selection_${itemKey}_${jumlah}`)
        .setLabel("Kembali")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⬅️"),
      new ButtonBuilder()
        .setCustomId(`cancel_order_${itemKey}_${jumlah}`)
        .setLabel("Batal")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    buttons.push(actionRow);

    await interaction.update({
      embeds: [embed],
      components: buttons,
    });
  } catch (error) {
    console.error("Error in handleAdminSelection:", error);
    await interaction.reply({
      content: "❌ Terjadi kesalahan saat memproses pilihan admin.",
      ephemeral: true,
    });
  }
};
