// commands/midman.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = async (message, args) => {
  try {
    // Check if user is in a guild (server)
    if (!message.guild) {
      return message.reply("❌ Command ini hanya bisa digunakan di server!");
    }

    // Create modal for midman request
    const modal = new ModalBuilder()
      .setCustomId(`midman_form_${message.author.id}`)
      .setTitle("📋 Request Midman Service");

    // Partner name input
    const partnerInput = new TextInputBuilder()
      .setCustomId("partner_name")
      .setLabel("Nama Partner (Pembeli/Penjual)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Masukkan nama partner transaksi...")
      .setRequired(true)
      .setMaxLength(100);

    // Transaction amount input
    const amountInput = new TextInputBuilder()
      .setCustomId("transaction_amount")
      .setLabel("Nominal Transaksi")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Contoh: 50000")
      .setRequired(true)
      .setMaxLength(20);

    // Transaction description input
    const descriptionInput = new TextInputBuilder()
      .setCustomId("transaction_description")
      .setLabel("Deskripsi Transaksi")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Jelaskan detail transaksi (item, quantity, dll)...")
      .setRequired(true)
      .setMaxLength(500);

    // Partner Discord ID/Username input
    const partnerIdInput = new TextInputBuilder()
      .setCustomId("partner_id")
      .setLabel("Discord ID")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Contoh:123456789012345678")
      .setRequired(true)
      .setMaxLength(100);

    // Additional notes input
    const notesInput = new TextInputBuilder()
      .setCustomId("additional_notes")
      .setLabel("Catatan Tambahan (Opsional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Catatan khusus untuk admin...")
      .setRequired(false)
      .setMaxLength(300);

    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(partnerInput);
    const secondActionRow = new ActionRowBuilder().addComponents(amountInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(
      descriptionInput
    );
    const fourthActionRow = new ActionRowBuilder().addComponents(
      partnerIdInput
    );
    const fifthActionRow = new ActionRowBuilder().addComponents(notesInput);

    modal.addComponents(
      firstActionRow,
      secondActionRow,
      thirdActionRow,
      fourthActionRow,
      fifthActionRow
    );

    // Send modal as a reply with embed explaining the process
    const embed = new EmbedBuilder()
      .setTitle("🤝 Midman Service")
      .setDescription(
        "**Cara menggunakan layanan Midman:**\n\n" +
          "1️⃣ Klik tombol **Request Midman** di bawah\n" +
          "2️⃣ Isi form dengan lengkap dan benar\n" +
          "3️⃣ Tunggu admin approve request Anda\n" +
          "4️⃣ Channel transaksi akan dibuat otomatis\n" +
          "5️⃣ Lakukan transaksi sesuai panduan admin\n" +
          "6️⃣ Setelah selesai, admin akan close transaksi\n\n" +
          "⚠️ **Penting:** Pastikan data yang dimasukkan benar!"
      )
      .setColor(0x00ae86)
      .setFooter({ text: "RBLX Syndicate - Midman Service" })
      .setTimestamp();

    const requestButton = new ButtonBuilder()
      .setCustomId(`show_midman_modal_${message.author.id}`)
      .setLabel("📋 Request Midman")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🤝");

    //const cancelButton = new ButtonBuilder()
    //  .setCustomId(`cancel_midman_${message.author.id}`)
    //  .setLabel("❌ Cancel")
    //  .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
      requestButton
      //cancelButton
    );

    await message.reply({
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    console.error("Error in midman command:", error);
    message.reply(
      "❌ Terjadi kesalahan saat membuat request midman. Silakan coba lagi."
    );
  }
};
