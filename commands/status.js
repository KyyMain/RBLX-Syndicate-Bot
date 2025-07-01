// commands/status.js
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = async (message) => {
  try {
    const userId = message.author.id;

    // Load transactions
    const transactionsPath = path.join(__dirname, "../data/transactions.json");
    let transactions = [];

    try {
      if (fs.existsSync(transactionsPath)) {
        const data = await fs.promises.readFile(transactionsPath, "utf8");
        transactions = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading transactions:", error);
      return message.reply("❌ Terjadi kesalahan saat memuat data transaksi.");
    }

    const userTxs = transactions.filter((tx) => tx.user === userId);

    if (userTxs.length === 0) {
      return message.reply("❌ Kamu belum memiliki transaksi apapun.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 Status Transaksi Kamu")
      .setColor(0x3399ff)
      .setTimestamp()
      .setFooter({ text: "RBLX Syndicate Bot - Transaction Status" });

    // Show last 5 transactions, most recent first
    userTxs
      .slice(-5)
      .reverse()
      .forEach((tx) => {
        // Determine status icon and color
        let statusIcon = "⏳";
        let statusText = tx.status.toUpperCase();

        switch (tx.status) {
          case "pending":
            statusIcon = "⏳";
            break;
          case "proof_uploaded":
            statusIcon = "📤";
            statusText = "MENUNGGU VERIFIKASI";
            break;
          case "approved":
            statusIcon = "✅ ";
            statusText = "BERHASIL";
            break;
          case "rejected":
            statusIcon = "❌";
            statusText = "DITOLAK";
            break;
          case "done":
            statusIcon = "✅";
            statusText = "SELESAI";
            break;
        }

        // Format timestamp
        let timeString = "Unknown";
        if (tx.timestamp) {
          timeString = new Date(tx.timestamp).toLocaleString("id-ID");
        } else if (tx.time) {
          timeString = new Date(tx.time).toLocaleString("id-ID");
        } else if (tx.createdAt) {
          timeString = new Date(tx.createdAt).toLocaleString("id-ID");
        }

        let fieldValue = `🕒 ${timeString}\n📌 Status: **${statusIcon} ${statusText}**`;

        // Add transaction ID if available
        if (tx.id) {
          fieldValue += `\n🆔 ID: \`${tx.id}\``;
        }

        // Add method if available
        if (tx.method) {
          fieldValue += `\n💳 Metode: ${tx.method.toUpperCase()}`;
        }

        // Add total price if available
        if (tx.totalPrice) {
          fieldValue += `\n💰 Total: Rp ${tx.totalPrice.toLocaleString(
            "id-ID"
          )}`;
        }

        embed.addFields({
          name: `${tx.item} x${tx.amount}`,
          value: fieldValue,
          inline: false,
        });
      });

    // Add summary
    const pendingCount = userTxs.filter((tx) => tx.status === "pending").length;
    const approvedCount = userTxs.filter(
      (tx) => tx.status === "approved" || tx.status === "done"
    ).length;
    const rejectedCount = userTxs.filter(
      (tx) => tx.status === "rejected"
    ).length;

    embed.setDescription(
      `📊 **Ringkasan Transaksi:**\n` +
        `⏳ Pending: ${pendingCount}\n` +
        `✅ Berhasil: ${approvedCount}\n` +
        `❌ Ditolak: ${rejectedCount}\n` +
        `📈 Total: ${userTxs.length}\n\n` +
        `_Menampilkan 5 transaksi terakhir_`
    );

    message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in status command:", error);
    message.reply("❌ Terjadi kesalahan saat memuat status transaksi.");
  }
};
