// utils/handlePaymentChoice.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const items = require("../data/items.json");
const config = require("../config.json");
const fs = require("fs");
const path = require("path");

module.exports = async (interaction) => {
  try {
    // Parse customId dengan validasi format baru (menggunakan pipe |)
    const customIdParts = interaction.customId.split("|");
    if (customIdParts.length !== 6 || customIdParts[0] !== "pay") {
      throw new Error("Format customId tidak valid");
    }

    const [, method, itemKey, jumlahStr, userId, adminId] = customIdParts;
    const jumlah = parseInt(jumlahStr);

    // Validasi input
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error("Jumlah tidak valid");
    }

    if (!items[itemKey]) {
      throw new Error("Item tidak ditemukan");
    }

    const item = items[itemKey];

    // Check stock availability
    if (item.stock < jumlah) {
      throw new Error(`Stok tidak cukup! Sisa stok: ${item.stock}`);
    }

    // Fetch user dengan error handling
    let user;
    try {
      user = await interaction.client.users.fetch(userId);
    } catch (error) {
      throw new Error("User tidak ditemukan atau tidak bisa mengirim DM");
    }

    // Load dan simpan transaksi dengan async/await
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

    // Generate transaction ID
    const transactionId = `txn_${Date.now()}_${userId}`;

    // Tambah transaksi baru
    const newTransaction = {
      id: transactionId,
      user: userId,
      username: user.username,
      item: item.name,
      itemKey: itemKey,
      amount: jumlah,
      totalPrice: item.price * jumlah,
      method: method,
      adminId: adminId, // Tambahkan adminId ke transaksi
      timestamp: Date.now(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    transactions.push(newTransaction);

    // Simpan transaksi
    try {
      await fs.promises.writeFile(
        transactionsPath,
        JSON.stringify(transactions, null, 2)
      );
    } catch (error) {
      console.error("Error saving transaction:", error);
      throw new Error("Gagal menyimpan transaksi");
    }

    // Siapkan informasi pembayaran
    let paymentMessage = "";
    let files = [];

    // Validasi metode pembayaran ada di config
    const methodUpper = method.toUpperCase();
    if (!config.payments || !config.payments[methodUpper]) {
      throw new Error(
        `Metode pembayaran ${methodUpper} tidak dikonfigurasi di config.json. Metode yang tersedia: ${Object.keys(
          config.payments || {}
        ).join(", ")}`
      );
    }

    const paymentConfig = config.payments[methodUpper];

    if (paymentConfig.type === "image") {
      // Untuk QRIS atau pembayaran dengan gambar
      paymentMessage =
        `📷 **Pembayaran ${methodUpper}**\n\n` +
        `🛒 Item: ${item.name}\n` +
        `📦 Jumlah: ${jumlah}\n` +
        `💰 Total: Rp ${(item.price * jumlah).toLocaleString("id-ID")}\n` +
        `🆔 ID Transaksi: \`${transactionId}\`\n\n` +
        `Scan QR Code di bawah ini untuk melakukan pembayaran:`;

      // Jika menggunakan URL gambar
      if (paymentConfig.value.startsWith("http")) {
        paymentMessage += `\n\n🔗 [Klik untuk melihat QR Code](${paymentConfig.value})`;
      } else {
        // Jika menggunakan file lokal
        const imagePath = path.join(__dirname, "../", paymentConfig.value);
        if (fs.existsSync(imagePath)) {
          files = [imagePath];
        } else {
          paymentMessage += `\n\n🔗 [Klik untuk melihat QR Code](${paymentConfig.value})`;
        }
      }
    } else {
      // Untuk pembayaran dengan nomor/text
      const methodName = methodUpper;

      paymentMessage =
        `💳 **Pembayaran ${methodName}**\n\n` +
        `🛒 Item: ${item.name}\n` +
        `📦 Jumlah: ${jumlah}\n` +
        `💰 Total: Rp ${(item.price * jumlah).toLocaleString("id-ID")}\n` +
        `🆔 ID Transaksi: \`${transactionId}\`\n\n` +
        `📱 ${methodName}: \`${paymentConfig.value}\`\n` +
        `💡 Silakan transfer sesuai nominal di atas`;
    }

    // Kirim informasi pembayaran ke user
    try {
      await user.send({
        content: paymentMessage,
        files: files,
      });
    } catch (error) {
      console.error("Error sending payment info:", error);
      throw new Error(
        "Tidak bisa mengirim DM ke user. Silakan cek pengaturan DM Anda."
      );
    }

    // Kirim tombol konfirmasi dengan format yang benar (gunakan format pipe untuk konsistensi)
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `user_paid|${itemKey}|${jumlah}|${userId}|${method}|${adminId}`
        )
        .setLabel("✅ Sudah Transfer")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`cancel_payment|${transactionId}`)
        .setLabel("❌ Batal")
        .setStyle(ButtonStyle.Danger)
    );

    const confirmMessage =
      `⏳ **Menunggu Konfirmasi Pembayaran**\n\n` +
      `Setelah melakukan transfer, silakan klik tombol "✅ Sudah Transfer" di bawah ini.\n` +
      `Jika ingin membatalkan transaksi, klik "❌ Batal".\n\n` +
      `⚠️ **Penting:** Simpan ID transaksi Anda: \`${transactionId}\``;

    try {
      await user.send({
        content: confirmMessage,
        components: [confirmRow],
      });
    } catch (error) {
      console.error("Error sending confirmation buttons:", error);
      throw new Error("Tidak bisa mengirim pesan konfirmasi ke user");
    }

    // Response ke interaction
    const successMessage =
      `✅ **Metode ${methodUpper} Dipilih**\n\n` +
      `📨 Informasi pembayaran telah dikirim ke DM kamu!\n` +
      `🆔 ID Transaksi: \`${transactionId}\`\n\n` +
      `💡 Silakan cek pesan pribadi untuk melanjutkan pembayaran.`;

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: successMessage,
        components: [],
      });
    } else {
      await interaction.update({
        content: successMessage,
        components: [],
      });
    }
  } catch (error) {
    console.error("Error in handlePaymentChoice:", error);

    // Error response
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
          flags: 64, // MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      console.error("Error sending error response:", replyError);
    }
  }
};
