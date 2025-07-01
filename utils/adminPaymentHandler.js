const { EmbedBuilder } = require("discord.js");
const config = require("../config.json");
const fs = require("fs");
const path = require("path");

module.exports = {
  async approvePayment(interaction) {
    try {
      // Fixed: Extract transaction ID properly from customId
      // customId format: approve_payment_txn_1751298655302_453027780297490442
      const customIdParts = interaction.customId.split("_");
      const transactionId = customIdParts.slice(2).join("_"); // Join everything after "approve_payment_"
      console.log(`Approving payment for transaction ID: ${transactionId}`);

      const transactionsPath = path.join(
        __dirname,
        "../data/transactions.json"
      );
      const itemsPath = path.join(__dirname, "../data/items.json");

      let transactions = [];
      let items = {};

      // Load transactions
      try {
        if (fs.existsSync(transactionsPath)) {
          const data = await fs.promises.readFile(transactionsPath, "utf8");
          transactions = JSON.parse(data);
        }
      } catch (error) {
        console.error("Error reading transactions:", error);
        throw new Error("Failed to load transactions data");
      }

      // Load items
      try {
        if (fs.existsSync(itemsPath)) {
          const data = await fs.promises.readFile(itemsPath, "utf8");
          items = JSON.parse(data);
        }
      } catch (error) {
        console.error("Error reading items:", error);
        throw new Error("Failed to load items data");
      }

      console.log(`Looking for transaction: ${transactionId}`);
      console.log(
        `Available transactions:`,
        transactions.map((t) => t.id)
      );

      const transactionIndex = transactions.findIndex(
        (t) => t.id === transactionId
      );

      if (transactionIndex === -1) {
        console.log(
          `Transaction ${transactionId} not found in transactions array`
        );
        throw new Error(`Transaction ${transactionId} not found`);
      }

      const transaction = transactions[transactionIndex];
      console.log(`Found transaction:`, transaction);

      if (transaction.status !== "proof_uploaded") {
        throw new Error(
          `Transaction cannot be approved. Current status: ${transaction.status}`
        );
      }

      const item = items[transaction.itemKey];
      if (!item) {
        throw new Error(`Item ${transaction.itemKey} not found in items data`);
      }

      if (item.stock < transaction.amount) {
        throw new Error(
          `Insufficient stock. Available: ${item.stock}, Required: ${transaction.amount}`
        );
      }

      // Update stock
      items[transaction.itemKey].stock -= transaction.amount;
      transactions[transactionIndex].status = "approved";
      transactions[transactionIndex].approvedBy = interaction.user.id;
      transactions[transactionIndex].approvedAt = new Date().toISOString();

      // Save updated data
      try {
        await fs.promises.writeFile(itemsPath, JSON.stringify(items, null, 2));
        await fs.promises.writeFile(
          transactionsPath,
          JSON.stringify(transactions, null, 2)
        );
        console.log("Data saved successfully");
      } catch (error) {
        console.error("Error saving data:", error);
        throw new Error("Failed to save updated data");
      }

      // Send notification to user
      try {
        const user = await interaction.client.users.fetch(transaction.user);
        const userEmbed = new EmbedBuilder()
          .setTitle("✅ Pembayaran Disetujui")
          .setColor("#00FF00")
          .setDescription(
            `Pembayaran Anda telah disetujui!\n\n` +
              `🆔 **Transaction ID:** \`${transactionId}\`\n` +
              `🛒 **Item:** ${transaction.item}\n` +
              `📦 **Jumlah:** ${transaction.amount}\n` +
              `💰 **Total:** Rp ${transaction.totalPrice.toLocaleString(
                "id-ID"
              )}\n\n` +
              `🎮 **Link Server:** ${config.privateServerLink}\n\n` +
              `Terima kasih telah berbelanja di RBLX Syndicate! 💖`
          )
          .setTimestamp()
          .setFooter({ text: "RBLX Syndicate Bot - Payment Approved" });

        await user.send({ embeds: [userEmbed] });
        console.log("Notification sent to user successfully");
      } catch (err) {
        console.error("Error sending notification to user:", err);
        // Don't throw error here, just log it
      }

      // Update the interaction with success message
      const successEmbed = new EmbedBuilder()
        .setTitle("✅ Pembayaran Berhasil Disetujui")
        .setColor("#00FF00")
        .setDescription(
          `Transaksi berhasil disetujui!\n\n` +
            `🆔 **Transaction ID:** \`${transactionId}\`\n` +
            `👤 **User:** <@${transaction.user}>\n` +
            `🛒 **Item:** ${transaction.item}\n` +
            `📦 **Jumlah:** ${transaction.amount}\n` +
            `💰 **Total:** Rp ${transaction.totalPrice.toLocaleString(
              "id-ID"
            )}\n` +
            `💳 **Metode:** ${transaction.method.toUpperCase()}\n\n` +
            `✅ Link server telah dikirim ke user\n` +
            `📦 Stok tersisa: ${items[transaction.itemKey].stock}`
        )
        .setTimestamp()
        .setFooter({ text: `Disetujui oleh ${interaction.user.tag}` });

      await interaction.update({
        embeds: [successEmbed],
        components: [],
      });
    } catch (error) {
      console.error("Error approving payment:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Gagal Menyetujui Pembayaran")
        .setColor("#FF0000")
        .setDescription(`**Error:** ${error.message}`)
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
  },

  async rejectPayment(interaction) {
    try {
      // Fixed: Extract transaction ID properly from customId
      // customId format: reject_payment_txn_1751298655302_453027780297490442
      const customIdParts = interaction.customId.split("_");
      const transactionId = customIdParts.slice(2).join("_"); // Join everything after "reject_payment_"
      console.log(`Rejecting payment for transaction ID: ${transactionId}`);

      const transactionsPath = path.join(
        __dirname,
        "../data/transactions.json"
      );
      let transactions = [];

      // Load transactions
      try {
        if (fs.existsSync(transactionsPath)) {
          const data = await fs.promises.readFile(transactionsPath, "utf8");
          transactions = JSON.parse(data);
        }
      } catch (error) {
        console.error("Error reading transactions:", error);
        throw new Error("Failed to load transactions data");
      }

      const transactionIndex = transactions.findIndex(
        (t) => t.id === transactionId
      );

      if (transactionIndex === -1) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      const transaction = transactions[transactionIndex];

      if (transaction.status !== "proof_uploaded") {
        throw new Error(
          `Transaction cannot be rejected. Current status: ${transaction.status}`
        );
      }

      // Update transaction status
      transactions[transactionIndex].status = "rejected";
      transactions[transactionIndex].rejectedBy = interaction.user.id;
      transactions[transactionIndex].rejectedAt = new Date().toISOString();

      // Save updated data
      try {
        await fs.promises.writeFile(
          transactionsPath,
          JSON.stringify(transactions, null, 2)
        );
      } catch (error) {
        console.error("Error saving data:", error);
        throw new Error("Failed to save updated data");
      }

      // Send notification to user
      try {
        const user = await interaction.client.users.fetch(transaction.user);
        const userEmbed = new EmbedBuilder()
          .setTitle("❌ Pembayaran Ditolak")
          .setColor("#FF0000")
          .setDescription(
            `Maaf, pembayaran Anda ditolak.\n\n` +
              `🆔 **Transaction ID:** \`${transactionId}\`\n` +
              `🛒 **Item:** ${transaction.item}\n` +
              `📦 **Jumlah:** ${transaction.amount}\n` +
              `💰 **Total:** Rp ${transaction.totalPrice.toLocaleString(
                "id-ID"
              )}\n\n` +
              `💡 Silakan hubungi admin untuk informasi lebih lanjut atau coba lakukan pembelian ulang.`
          )
          .setTimestamp()
          .setFooter({ text: "RBLX Syndicate Bot - Payment Rejected" });

        await user.send({ embeds: [userEmbed] });
      } catch (err) {
        console.error("Error sending notification to user:", err);
      }

      // Update the interaction with success message
      const successEmbed = new EmbedBuilder()
        .setTitle("❌ Pembayaran Berhasil Ditolak")
        .setColor("#FF0000")
        .setDescription(
          `Transaksi berhasil ditolak!\n\n` +
            `🆔 **Transaction ID:** \`${transactionId}\`\n` +
            `👤 **User:** <@${transaction.user}>\n` +
            `🛒 **Item:** ${transaction.item}\n` +
            `📦 **Jumlah:** ${transaction.amount}\n` +
            `💰 **Total:** Rp ${transaction.totalPrice.toLocaleString(
              "id-ID"
            )}\n\n` +
            `📨 Notifikasi penolakan telah dikirim ke user`
        )
        .setTimestamp()
        .setFooter({ text: `Ditolak oleh ${interaction.user.tag}` });

      await interaction.update({
        embeds: [successEmbed],
        components: [],
      });
    } catch (error) {
      console.error("Error rejecting payment:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Gagal Menolak Pembayaran")
        .setColor("#FF0000")
        .setDescription(`**Error:** ${error.message}`)
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
  },

  async viewTransaction(interaction) {
    try {
      // Fixed: Extract transaction ID properly from customId
      // customId format: view_transaction_txn_1751298655302_453027780297490442
      const customIdParts = interaction.customId.split("_");
      const transactionId = customIdParts.slice(2).join("_"); // Join everything after "view_transaction_"
      console.log(`Viewing transaction ID: ${transactionId}`);

      const transactionsPath = path.join(
        __dirname,
        "../data/transactions.json"
      );
      let transactions = [];

      // Load transactions
      try {
        if (fs.existsSync(transactionsPath)) {
          const data = await fs.promises.readFile(transactionsPath, "utf8");
          transactions = JSON.parse(data);
        }
      } catch (error) {
        console.error("Error reading transactions:", error);
        throw new Error("Failed to load transactions data");
      }

      const transaction = transactions.find((t) => t.id === transactionId);

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      // Create detailed view embed
      const detailEmbed = new EmbedBuilder()
        .setTitle("🔍 Detail Transaksi")
        .setColor("#3498DB")
        .addFields(
          {
            name: "🆔 Transaction ID",
            value: `\`${transaction.id}\``,
            inline: false,
          },
          {
            name: "👤 User Info",
            value: `<@${transaction.user}> (${
              transaction.username || "Unknown"
            })`,
            inline: true,
          },
          {
            name: "📊 Status",
            value: transaction.status.toUpperCase(),
            inline: true,
          },
          {
            name: "🛒 Item",
            value: transaction.item,
            inline: true,
          },
          {
            name: "📦 Jumlah",
            value: transaction.amount.toString(),
            inline: true,
          },
          {
            name: "💰 Total Harga",
            value: `Rp ${transaction.totalPrice.toLocaleString("id-ID")}`,
            inline: true,
          },
          {
            name: "💳 Metode",
            value: transaction.method.toUpperCase(),
            inline: true,
          },
          {
            name: "⏰ Created At",
            value: `<t:${Math.floor(transaction.timestamp / 1000)}:F>`,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "RBLX Syndicate Bot - Transaction Details" });

      // Add additional fields based on status
      if (transaction.proofUploadedAt) {
        detailEmbed.addFields({
          name: "📤 Proof Uploaded",
          value: `<t:${Math.floor(
            new Date(transaction.proofUploadedAt).getTime() / 1000
          )}:F>`,
          inline: true,
        });
      }

      if (transaction.approvedAt) {
        detailEmbed.addFields({
          name: "✅ Approved At",
          value: `<t:${Math.floor(
            new Date(transaction.approvedAt).getTime() / 1000
          )}:F>`,
          inline: true,
        });
      }

      if (transaction.rejectedAt) {
        detailEmbed.addFields({
          name: "❌ Rejected At",
          value: `<t:${Math.floor(
            new Date(transaction.rejectedAt).getTime() / 1000
          )}:F>`,
          inline: true,
        });
      }

      // Add proof image if available
      if (transaction.proofUrl) {
        detailEmbed.setImage(transaction.proofUrl);
      }

      await interaction.reply({
        embeds: [detailEmbed],
        flags: 64, // Ephemeral
      });
    } catch (error) {
      console.error("Error viewing transaction:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Gagal Melihat Detail Transaksi")
        .setColor("#FF0000")
        .setDescription(`**Error:** ${error.message}`)
        .setTimestamp();

      await interaction.reply({
        embeds: [errorEmbed],
        flags: 64,
      });
    }
  },
};
