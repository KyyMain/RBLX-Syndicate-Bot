// utils/cancelPayment.js
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = async (interaction) => {
  try {
    // Fixed: Extract transaction ID properly from customId
    // customId format: cancel_payment_txn_1751299185123_453027780297490442
    const customIdParts = interaction.customId.split("_");
    const transactionId = customIdParts.slice(2).join("_"); // Join everything after "cancel_payment_"
    const userId = interaction.user.id;

    console.log(`Cancelling payment for transaction ID: ${transactionId}`);
    console.log(`User ID: ${userId}`);

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
      throw new Error("Failed to load transaction data");
    }

    console.log(`Looking for transaction: ${transactionId}`);
    console.log(
      `Available transactions:`,
      transactions.map((t) => `${t.id} (user: ${t.user})`)
    );

    // Find transaction
    const transactionIndex = transactions.findIndex(
      (t) => t.id === transactionId && t.user === userId
    );

    if (transactionIndex === -1) {
      console.log(`Transaction ${transactionId} not found for user ${userId}`);
      throw new Error(
        "Transaction not found or you don't have permission to cancel it"
      );
    }

    const transaction = transactions[transactionIndex];
    console.log(`Found transaction:`, transaction);

    // Check if transaction can be cancelled
    if (transaction.status === "approved" || transaction.status === "done") {
      throw new Error("Cannot cancel approved or completed transactions");
    }

    // Update transaction status
    transactions[transactionIndex].status = "cancelled";
    transactions[transactionIndex].cancelledAt = new Date().toISOString();

    // Save updated transactions
    await fs.promises.writeFile(
      transactionsPath,
      JSON.stringify(transactions, null, 2)
    );

    console.log("Transaction cancelled successfully");

    const embed = new EmbedBuilder()
      .setTitle("❌ Transaksi Dibatalkan")
      .setColor("#FF0000")
      .setDescription(
        `Transaksi berhasil dibatalkan.\n\n` +
          `🆔 **ID Transaksi:** \`${transactionId}\`\n` +
          `🛒 **Item:** ${transaction.item}\n` +
          `📦 **Jumlah:** ${transaction.amount}\n` +
          `💰 **Total:** Rp ${transaction.totalPrice.toLocaleString(
            "id-ID"
          )}\n\n` +
          `💡 Anda dapat melakukan pembelian ulang kapan saja.`
      )
      .setTimestamp()
      .setFooter({ text: "RBLX Syndicate Bot - Transaction Cancelled" });

    await interaction.update({
      embeds: [embed],
      components: [],
    });
  } catch (error) {
    console.error("Error cancelling payment:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Gagal Membatalkan Transaksi")
      .setColor("#FF0000")
      .setDescription(`${error.message}`)
      .setTimestamp();

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          embeds: [errorEmbed],
          components: [],
        });
      } else {
        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Error sending error response:", replyError);
    }
  }
};
