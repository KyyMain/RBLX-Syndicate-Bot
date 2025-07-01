// utils/userUploadProof.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { getActiveAdmins } = require("./adminHelper");
const fs = require("fs");
const path = require("path");

module.exports = async (interaction) => {
  try {
    console.log(`Processing user_paid interaction: ${interaction.customId}`);

    // Parse customId dengan format baru (menggunakan pipe |)
    const customIdParts = interaction.customId.split("|");
    console.log("CustomId parts:", customIdParts);

    if (customIdParts.length !== 6 || customIdParts[0] !== "user_paid") {
      console.error(
        `Invalid customId format. Expected 6 parts, got ${customIdParts.length}`
      );
      throw new Error("Invalid customId format");
    }

    const [, itemKey, jumlahStr, userId, method, adminId] = customIdParts;
    const jumlah = parseInt(jumlahStr);

    console.log("Parsed data:", { itemKey, jumlah, userId, method, adminId });

    // Validasi input
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error("Jumlah tidak valid");
    }

    // Validasi user ID
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ Anda tidak memiliki akses untuk tombol ini.",
        ephemeral: true,
      });
    }

    // Load items data
    delete require.cache[require.resolve("../data/items.json")];
    const items = require("../data/items.json");

    if (!items[itemKey]) {
      throw new Error("Item tidak ditemukan");
    }

    const item = items[itemKey];
    const totalPrice = item.price * jumlah;

    // Load active admins
    const activeAdmins = getActiveAdmins();
    const selectedAdmin = activeAdmins[adminId];

    if (!selectedAdmin) {
      return interaction.reply({
        content: "❌ Admin yang dipilih tidak aktif lagi.",
        ephemeral: true,
      });
    }

    // Load transactions untuk mencari transaksi yang sesuai
    let transactions = [];
    const transactionsPath = path.join(__dirname, "../data/transactions.json");

    try {
      if (fs.existsSync(transactionsPath)) {
        const data = await fs.promises.readFile(transactionsPath, "utf8");
        transactions = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading transactions:", error);
      transactions = [];
    }

    // Cari transaksi yang pending untuk user ini dengan item dan jumlah yang sama
    const pendingTransaction = transactions.find(
      (t) =>
        t.user === userId &&
        t.itemKey === itemKey &&
        t.amount === jumlah &&
        t.method === method &&
        t.status === "pending"
    );

    if (!pendingTransaction) {
      return interaction.reply({
        content: "❌ Transaksi tidak ditemukan atau sudah diproses.",
        ephemeral: true,
      });
    }

    // Respond to user and ask for proof upload
    const uploadEmbed = new EmbedBuilder()
      .setTitle("📤 Upload Bukti Pembayaran")
      .setColor("#FFA500")
      .setDescription(
        `Silakan upload bukti pembayaran Anda dengan mengirim gambar ke chat ini.\n\n` +
          `🆔 **ID Transaksi:** \`${pendingTransaction.id}\`\n` +
          `🛒 **Item:** ${pendingTransaction.item}\n` +
          `📦 **Jumlah:** ${pendingTransaction.amount}\n` +
          `💰 **Total:** Rp ${pendingTransaction.totalPrice.toLocaleString(
            "id-ID"
          )}\n` +
          `💳 **Metode:** ${pendingTransaction.method.toUpperCase()}\n\n` +
          `⏱️ **Waktu:** 60 detik untuk upload bukti pembayaran\n` +
          `📸 **Format:** JPG, PNG, GIF, atau format gambar lainnya`
      )
      .setTimestamp()
      .setFooter({ text: "Upload gambar bukti pembayaran sekarang!" });

    await interaction.update({
      embeds: [uploadEmbed],
      components: [],
    });

    // Create message collector for proof upload
    const filter = (m) => m.author.id === userId && m.attachments.size > 0;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000, // 60 seconds
      max: 1,
    });

    collector.on("collect", async (msg) => {
      try {
        const attachment = msg.attachments.first();
        console.log(
          "Received attachment:",
          attachment.name,
          attachment.contentType
        );

        // Validate attachment is image
        if (!attachment.contentType?.startsWith("image/")) {
          await msg.reply("❌ File harus berupa gambar (JPG, PNG, GIF, dll)");
          return;
        }

        // Find transaction index
        const transactionIndex = transactions.findIndex(
          (t) => t.id === pendingTransaction.id
        );

        if (transactionIndex === -1) {
          throw new Error("Transaction index not found");
        }

        // Update transaction status
        transactions[transactionIndex].status = "proof_uploaded";
        transactions[transactionIndex].proofUploadedAt =
          new Date().toISOString();
        transactions[transactionIndex].proofUrl = attachment.url;

        // Save updated transactions
        await fs.promises.writeFile(
          transactionsPath,
          JSON.stringify(transactions, null, 2)
        );
        console.log("Transaction updated successfully");

        // Get config for admin notification
        const config = require("../config.json");

        // Send notification to admin directly (if adminId is available)
        if (adminId && adminId !== userId) {
          try {
            const adminUser = await interaction.client.users.fetch(adminId);

            // Create embed for admin notification
            const adminEmbed = new EmbedBuilder()
              .setTitle("🔔 Bukti Pembayaran Diterima")
              .setColor("#FFA500")
              .addFields(
                {
                  name: "👤 User",
                  value: `<@${userId}> (${
                    pendingTransaction.username || "Unknown"
                  })`,
                  inline: true,
                },
                {
                  name: "🆔 Transaction ID",
                  value: `\`${pendingTransaction.id}\``,
                  inline: true,
                },
                {
                  name: "🛒 Item",
                  value: pendingTransaction.item,
                  inline: true,
                },
                {
                  name: "📦 Jumlah",
                  value: pendingTransaction.amount.toString(),
                  inline: true,
                },
                {
                  name: "💰 Total Harga",
                  value: `Rp ${pendingTransaction.totalPrice.toLocaleString(
                    "id-ID"
                  )}`,
                  inline: true,
                },
                {
                  name: "💳 Metode",
                  value: pendingTransaction.method.toUpperCase(),
                  inline: true,
                },
                {
                  name: "⏰ Waktu Upload",
                  value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                  inline: false,
                }
              )
              .setImage(attachment.url)
              .setTimestamp()
              .setFooter({ text: "RBLX Syndicate Bot - Payment System" });

            // Create action buttons for admin
            const adminRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`approve_payment_${pendingTransaction.id}`)
                .setLabel("✅ Setujui")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`reject_payment_${pendingTransaction.id}`)
                .setLabel("❌ Tolak")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`view_transaction_${pendingTransaction.id}`)
                .setLabel("👁️ Detail")
                .setStyle(ButtonStyle.Secondary)
            );

            // Send notification to admin
            await adminUser.send({
              content: `📨 **Bukti pembayaran baru diterima dari ${
                pendingTransaction.username || "Unknown"
              }!**`,
              embeds: [adminEmbed],
              components: [adminRow],
            });
            console.log(`Admin notification sent to ${adminId}`);
          } catch (error) {
            console.error("Error sending notification to admin:", error);
          }
        }

        // Also send to admin channel if configured
        if (config.adminChannelId) {
          try {
            const adminChannel = await interaction.client.channels.fetch(
              config.adminChannelId
            );

            if (adminChannel) {
              const adminEmbed = new EmbedBuilder()
                .setTitle("🔔 Bukti Pembayaran Diterima")
                .setColor("#FFA500")
                .addFields(
                  {
                    name: "👤 User",
                    value: `<@${userId}> (${
                      pendingTransaction.username || "Unknown"
                    })`,
                    inline: true,
                  },
                  {
                    name: "🆔 Transaction ID",
                    value: `\`${pendingTransaction.id}\``,
                    inline: true,
                  },
                  {
                    name: "🛒 Item",
                    value: pendingTransaction.item,
                    inline: true,
                  },
                  {
                    name: "📦 Jumlah",
                    value: pendingTransaction.amount.toString(),
                    inline: true,
                  },
                  {
                    name: "💰 Total Harga",
                    value: `Rp ${pendingTransaction.totalPrice.toLocaleString(
                      "id-ID"
                    )}`,
                    inline: true,
                  },
                  {
                    name: "💳 Metode",
                    value: pendingTransaction.method.toUpperCase(),
                    inline: true,
                  },
                  {
                    name: "⏰ Waktu Upload",
                    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                    inline: false,
                  }
                )
                .setImage(attachment.url)
                .setTimestamp()
                .setFooter({ text: "RBLX Syndicate Bot - Payment System" });

              const adminRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`approve_payment_${pendingTransaction.id}`)
                  .setLabel("✅ Setujui")
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`reject_payment_${pendingTransaction.id}`)
                  .setLabel("❌ Tolak")
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId(`view_transaction_${pendingTransaction.id}`)
                  .setLabel("👁️ Detail")
                  .setStyle(ButtonStyle.Secondary)
              );

              await adminChannel.send({
                content: `📨 **Bukti pembayaran baru diterima dari ${
                  pendingTransaction.username || "Unknown"
                }!**`,
                embeds: [adminEmbed],
                components: [adminRow],
              });
              console.log("Admin channel notification sent");
            }
          } catch (error) {
            console.error(
              "Error sending notification to admin channel:",
              error
            );
          }
        }

        // Confirm to user
        const successEmbed = new EmbedBuilder()
          .setTitle("✅ Bukti Pembayaran Berhasil Dikirim")
          .setColor("#00FF00")
          .setDescription(
            `Terima kasih! Bukti pembayaran Anda telah diterima dan sedang diproses oleh admin.\n\n` +
              `🆔 **ID Transaksi:** \`${pendingTransaction.id}\`\n` +
              `⏰ **Status:** Menunggu verifikasi admin\n\n` +
              `💡 Anda akan mendapatkan notifikasi setelah pembayaran diverifikasi.\n` +
              `📱 Pastikan DM Anda terbuka untuk menerima notifikasi.`
          )
          .setTimestamp()
          .setFooter({ text: "RBLX Syndicate Bot - Payment System" });

        await msg.reply({ embeds: [successEmbed] });
        console.log("User confirmation sent");
      } catch (error) {
        console.error("Error processing proof upload:", error);
        await msg.reply(
          "❌ Terjadi kesalahan saat memproses bukti pembayaran. Silakan coba lagi atau hubungi admin."
        );
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        console.log("No proof uploaded within time limit");
        interaction
          .followUp({
            content:
              "❌ Waktu upload bukti pembayaran habis. Silakan ulangi proses pembayaran dengan mengklik tombol '✅ Sudah Transfer' lagi.",
            ephemeral: true,
          })
          .catch(console.error);
      }
    });
  } catch (error) {
    console.error("Error in userUploadProof:", error);

    const errorMessage = `❌ **Terjadi Kesalahan**\n\n${error.message}\n\nSilakan coba lagi atau hubungi admin.`;

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: errorMessage,
          components: [],
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error("Error sending error response:", replyError);
    }
  }
};
