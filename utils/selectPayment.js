// utils/selectPayment.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { getActiveAdmins } = require("./adminHelper");

module.exports = async (message, itemKey, jumlah) => {
  try {
    // Clear cache dan ambil data items yang fresh
    delete require.cache[require.resolve("../data/items.json")];
    const items = require("../data/items.json");

    const item = items[itemKey];
    const totalPrice = item.price * jumlah;

    // Ambil admin yang aktif
    const activeAdmins = getActiveAdmins();
    const activeAdminCount = Object.keys(activeAdmins).length;

    if (activeAdminCount === 0) {
      return message.reply(
        "❌ Tidak ada admin yang aktif saat ini. Silakan coba lagi nanti."
      );
    }

    // Jika hanya ada 1 admin aktif, langsung tampilkan pilihan payment
    if (activeAdminCount === 1) {
      const [adminId, adminData] = Object.entries(activeAdmins)[0];
      return showPaymentMethods(
        message,
        itemKey,
        jumlah,
        item,
        totalPrice,
        adminId,
        adminData
      );
    }

    // Jika ada lebih dari 1 admin aktif, tampilkan pilihan admin
    const embed = new EmbedBuilder()
      .setTitle("👥 Pilih Admin")
      .setDescription(
        `**📦 Item:** ${item.name}\n` +
          `**🔢 Jumlah:** ${jumlah}\n` +
          `**💰 Total:** Rp${totalPrice.toLocaleString()}\n\n` +
          `Pilih admin yang ingin Anda gunakan untuk transaksi:`
      )
      .setColor(0x3399ff)
      .setTimestamp();

    const buttons = [];
    const adminEntries = Object.entries(activeAdmins);

    // Buat button untuk setiap admin (maksimal 5 per row)
    for (let i = 0; i < adminEntries.length; i += 5) {
      const row = new ActionRowBuilder();
      const rowAdmins = adminEntries.slice(i, i + 5);

      for (const [adminId, adminData] of rowAdmins) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`select_admin_${itemKey}_${jumlah}_${adminId}`)
            .setLabel(`${adminData.name}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji("👤")
        );
      }

      buttons.push(row);
    }

    // Tambah button cancel
    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cancel_order_${itemKey}_${jumlah}`)
        .setLabel("Batal")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    buttons.push(cancelRow);

    await message.author.send({
      embeds: [embed],
      components: buttons,
    });

    await message.reply("📩 Cek DM untuk pilihan admin dan metode pembayaran!");
  } catch (error) {
    console.error("Error in selectPayment:", error);
    message.reply(
      "❌ Gagal mengirim pilihan pembayaran. Pastikan DM Anda terbuka."
    );
  }
};

// Function untuk menampilkan metode pembayaran
async function showPaymentMethods(
  message,
  itemKey,
  jumlah,
  item,
  totalPrice,
  adminId,
  adminData
) {
  const config = require("../config.json");

  const embed = new EmbedBuilder()
    .setTitle("💳 Pilih Metode Pembayaran")
    .setDescription(
      `**📦 Item:** ${item.name}\n` +
        `**🔢 Jumlah:** ${jumlah}\n` +
        `**💰 Total:** Rp${totalPrice.toLocaleString()}\n` +
        `**👤 Admin:** ${adminData.name}\n\n` +
        `Pilih metode pembayaran:`
    )
    .setColor(0x3399ff)
    .setTimestamp();

  const buttons = [];
  const availablePayments = adminData.payments || [
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
        // Fixed customId format - menggunakan format yang konsisten
        const customId = `pay|${paymentMethod}|${itemKey}|${jumlah}|${message.author.id}|${adminId}`;

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(customId)
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

  // Tambah button cancel
  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cancel_order_${itemKey}_${jumlah}`)
      .setLabel("Batal")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌")
  );

  buttons.push(cancelRow);

  await message.author.send({
    embeds: [embed],
    components: buttons,
  });
}
