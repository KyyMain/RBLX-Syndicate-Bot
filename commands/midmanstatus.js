// commands/midmanstatus.js
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = async (message) => {
  try {
    const userId = message.author.id;

    // Load midman requests
    const midmanPath = path.join(__dirname, "../data/midman_requests.json");
    let requests = [];

    try {
      if (fs.existsSync(midmanPath)) {
        const data = await fs.promises.readFile(midmanPath, "utf8");
        requests = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading midman requests:", error);
      return message.reply("❌ Terjadi kesalahan saat memuat data midman.");
    }

    // Filter user's midman requests (as requester or partner)
    const userRequests = requests.filter(
      (req) => req.requester.id === userId || req.partner.id === userId
    );

    if (userRequests.length === 0) {
      return message.reply("❌ Kamu belum memiliki request midman apapun.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🤝 Status Midman Kamu")
      .setColor(0x00ae86)
      .setTimestamp()
      .setFooter({ text: "RBLX Syndicate Bot - Midman Status" });

    // Show last 5 requests, most recent first
    userRequests
      .slice(-5)
      .reverse()
      .forEach((req) => {
        // Determine status icon and color
        let statusIcon = "⏳";
        let statusText = req.status.toUpperCase();

        switch (req.status) {
          case "pending_approval":
            statusIcon = "⏳";
            statusText = "MENUNGGU APPROVAL";
            break;
          case "approved":
            statusIcon = "✅";
            statusText = "AKTIF";
            break;
          case "completed":
            statusIcon = "🎉";
            statusText = "SELESAI";
            break;
          case "rejected":
            statusIcon = "❌";
            statusText = "DITOLAK";
            break;
          case "cancelled":
            statusIcon = "🚫";
            statusText = "DIBATALKAN";
            break;
        }

        // Format timestamp
        let timeString = "Unknown";
        if (req.createdAt) {
          timeString = new Date(req.createdAt).toLocaleString("id-ID");
        }

        let fieldValue = `🕒 ${timeString}\n📌 Status: **${statusIcon} ${statusText}**`;

        // Add transaction ID
        fieldValue += `\n🆔 ID: \`${req.id}\``;

        // Add role in transaction
        const isRequester = req.requester.id === userId;
        fieldValue += `\n👤 Role: ${isRequester ? "Requester" : "Partner"}`;

        // Add partner info
        if (isRequester) {
          fieldValue += `\n🤝 Partner: ${req.partner.name}`;
        } else {
          fieldValue += `\n🤝 Requester: ${req.requester.username}`;
        }

        // Add channel if active
        if (req.channelId && req.status === "approved") {
          fieldValue += `\n📺 Channel: <#${req.channelId}>`;
        }

        // Add admin if approved
        if (req.adminId) {
          fieldValue += `\n🏛️ Admin: <@${req.adminId}>`;
        }

        embed.addFields({
          name: `💰 Rp ${req.transaction.amount.toLocaleString(
            "id-ID"
          )} - ${req.transaction.description.substring(0, 30)}${
            req.transaction.description.length > 30 ? "..." : ""
          }`,
          value: fieldValue,
          inline: false,
        });
      });

    // Add summary
    const pendingCount = userRequests.filter(
      (req) => req.status === "pending_approval"
    ).length;
    const activeCount = userRequests.filter(
      (req) => req.status === "approved"
    ).length;
    const completedCount = userRequests.filter(
      (req) => req.status === "completed"
    ).length;
    const rejectedCount = userRequests.filter(
      (req) => req.status === "rejected" || req.status === "cancelled"
    ).length;

    embed.setDescription(
      `📊 **Ringkasan Midman:**\n` +
        `⏳ Pending: ${pendingCount}\n` +
        `✅ Aktif: ${activeCount}\n` +
        `🎉 Selesai: ${completedCount}\n` +
        `❌ Ditolak/Dibatalkan: ${rejectedCount}\n` +
        `📈 Total: ${userRequests.length}\n\n` +
        `_Menampilkan 5 request terakhir_`
    );

    message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in midmanstatus command:", error);
    message.reply("❌ Terjadi kesalahan saat memuat status midman.");
  }
};
