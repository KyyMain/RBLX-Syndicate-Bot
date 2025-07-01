// utils/handleMidmanModal.js
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../config.json");

// Import utility functions from approval handler
const { parsePartnerId, fetchUserSafely } = require("./handleMidmanApproval");

module.exports = async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

    console.log("=== Processing Midman Request Form ===");

    // Get form data
    const partnerName = interaction.fields.getTextInputValue("partner_name");
    const transactionAmount =
      interaction.fields.getTextInputValue("transaction_amount");
    const transactionDescription = interaction.fields.getTextInputValue(
      "transaction_description"
    );
    const partnerId = interaction.fields.getTextInputValue("partner_id");
    const additionalNotes =
      interaction.fields.getTextInputValue("additional_notes") || "Tidak ada";

    console.log("Form data received:", {
      partnerName,
      transactionAmount,
      transactionDescription,
      partnerId,
      additionalNotes:
        additionalNotes !== "Tidak ada" ? additionalNotes : "None",
    });

    // Enhanced amount validation
    const cleanAmount = transactionAmount.replace(/[^\d]/g, "");
    const amount = parseInt(cleanAmount);

    if (isNaN(amount) || amount <= 0) {
      return interaction.editReply({
        content:
          "❌ Nominal transaksi tidak valid! Masukkan angka yang benar.\nContoh: 50000 atau 50,000",
        ephemeral: true,
      });
    }

    if (amount < 1000) {
      return interaction.editReply({
        content: "❌ Minimal nominal transaksi adalah Rp 1,000",
        ephemeral: true,
      });
    }

    console.log(
      `Transaction amount validated: Rp ${amount.toLocaleString("id-ID")}`
    );

    // Enhanced partner validation and fetching
    console.log(`Processing partner ID: "${partnerId}"`);

    const parsedPartnerId = parsePartnerId(partnerId);
    let partnerUser = null;
    let partnerValidationStatus = "not_found";

    if (parsedPartnerId) {
      console.log(`Attempting to fetch partner: ${parsedPartnerId}`);

      try {
        partnerUser = await fetchUserSafely(
          interaction.client,
          interaction.guild,
          partnerId,
          2 // Reduced retries for form submission speed
        );

        if (partnerUser) {
          partnerValidationStatus = "found";
          console.log(
            `✅ Partner found: ${partnerUser.tag} (${partnerUser.id})`
          );
        } else {
          partnerValidationStatus = "not_found";
          console.log(`❌ Partner not found: ${partnerId}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching partner: ${error.message}`);
        partnerValidationStatus = "error";
      }
    } else {
      console.log(`❌ Invalid partner ID format: ${partnerId}`);
      partnerValidationStatus = "invalid_format";
    }

    // Generate unique transaction ID with better entropy
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const transactionId = `MM${timestamp}${randomNum
      .toString()
      .padStart(4, "0")}`;

    console.log(`Generated transaction ID: ${transactionId}`);

    // Create enhanced midman request data
    const midmanRequest = {
      id: transactionId,
      requester: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
        tag: interaction.user.tag,
      },
      partner: {
        name: partnerName.trim(),
        id: partnerUser ? partnerUser.id : null,
        username: partnerUser ? partnerUser.username : "Unknown",
        tag: partnerUser ? partnerUser.tag : "Unknown",
        inputId: partnerId.trim(),
        validationStatus: partnerValidationStatus,
      },
      transaction: {
        amount: amount,
        description: transactionDescription.trim(),
        notes: additionalNotes.trim(),
      },
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      guildId: interaction.guild.id,
      channelId: null,
      adminId: null,
      metadata: {
        submittedVia: "modal_form",
        userAgent: "discord_bot",
        version: "2.0",
      },
    };

    console.log("Midman request created:", {
      id: midmanRequest.id,
      requester: midmanRequest.requester.tag,
      partner: midmanRequest.partner.name,
      amount: midmanRequest.transaction.amount,
      partnerStatus: midmanRequest.partner.validationStatus,
    });

    // Enhanced file operations with backup
    const midmanPath = path.join(__dirname, "../data/midman_requests.json");
    const backupPath = path.join(
      __dirname,
      "../data/midman_requests_backup.json"
    );
    let requests = [];

    try {
      if (fs.existsSync(midmanPath)) {
        const data = await fs.promises.readFile(midmanPath, "utf8");
        requests = JSON.parse(data);

        // Create backup
        try {
          await fs.promises.writeFile(backupPath, data);
          console.log("✅ Backup created successfully");
        } catch (backupError) {
          console.log("⚠️ Could not create backup:", backupError.message);
        }
      }
    } catch (error) {
      console.error("❌ Error reading midman requests:", error);
      requests = [];
    }

    // Check for duplicate requests (same requester + partner within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const duplicateRequest = requests.find(
      (req) =>
        req.requester.id === interaction.user.id &&
        req.partner.inputId === partnerId.trim() &&
        req.status === "pending_approval" &&
        new Date(req.createdAt) > fiveMinutesAgo
    );

    if (duplicateRequest) {
      return interaction.editReply({
        content: `❌ Anda sudah memiliki request midman yang serupa dalam 5 menit terakhir.\n**Transaction ID:** \`${duplicateRequest.id}\`\n\nSilakan tunggu approval atau batalkan request sebelumnya.`,
        ephemeral: true,
      });
    }

    // Add new request
    requests.push(midmanRequest);

    // Save with atomic write operation
    const tempPath = midmanPath + ".tmp";
    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(requests, null, 2));
      await fs.promises.rename(tempPath, midmanPath);
      console.log("✅ Midman request saved successfully");
    } catch (error) {
      console.error("❌ Error saving midman request:", error);
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }

      return interaction.editReply({
        content:
          "❌ Gagal menyimpan request midman. Silakan coba lagi dalam beberapa saat.",
        ephemeral: true,
      });
    }

    // Send to admin channel for approval
    const adminChannelId = config.adminChannelId;

    if (!adminChannelId) {
      console.error("❌ Admin channel ID not configured");
      return interaction.editReply({
        content:
          "❌ Konfigurasi admin channel tidak ditemukan. Hubungi developer.",
        ephemeral: true,
      });
    }

    let adminChannel;
    try {
      adminChannel = await interaction.client.channels.fetch(adminChannelId);
    } catch (error) {
      console.error("❌ Error fetching admin channel:", error);
      return interaction.editReply({
        content: "❌ Channel admin tidak dapat diakses. Hubungi developer.",
        ephemeral: true,
      });
    }

    if (!adminChannel) {
      return interaction.editReply({
        content: "❌ Channel admin tidak ditemukan. Hubungi developer.",
        ephemeral: true,
      });
    }

    // Create enhanced admin approval embed
    const adminEmbed = new EmbedBuilder()
      .setTitle("🤝 New Midman Request")
      .setColor(0xffa500)
      .setDescription(
        `**${interaction.user.tag}** telah mengajukan request midman`
      )
      .addFields(
        {
          name: "📋 Transaction ID",
          value: `\`${transactionId}\``,
          inline: true,
        },
        {
          name: "👤 Requester",
          value: `<@${interaction.user.id}>\n\`${interaction.user.tag}\``,
          inline: true,
        },
        {
          name: "🤝 Partner",
          value: partnerUser
            ? `<@${partnerUser.id}>\n\`${partnerUser.tag}\``
            : `**${partnerName}**\n\`ID: ${partnerId}\``,
          inline: true,
        },
        {
          name: "💰 Amount",
          value: `**Rp ${amount.toLocaleString("id-ID")}**`,
          inline: true,
        },
        {
          name: "📝 Description",
          value: `\`\`\`${transactionDescription}\`\`\``,
          inline: false,
        },
        {
          name: "🔍 Partner Validation",
          value: getPartnerValidationText(
            partnerValidationStatus,
            partnerId,
            partnerUser
          ),
          inline: false,
        }
      )
      .setFooter({
        text: `RBLX Syndicate - Midman Request | Submitted at`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

    if (additionalNotes !== "Tidak ada") {
      adminEmbed.addFields({
        name: "📋 Additional Notes",
        value: `\`\`\`${additionalNotes}\`\`\``,
        inline: false,
      });
    }

    // Create action buttons
    const approveButton = new ButtonBuilder()
      .setCustomId(`approve_midman_${transactionId}`)
      .setLabel("✅ Approve")
      .setStyle(ButtonStyle.Success);

    const rejectButton = new ButtonBuilder()
      .setCustomId(`reject_midman_${transactionId}`)
      .setLabel("❌ Reject")
      .setStyle(ButtonStyle.Danger);

    const adminRow = new ActionRowBuilder().addComponents(
      approveButton,
      rejectButton
    );

    // Send to admin channel with enhanced error handling
    try {
      const adminMessage = await adminChannel.send({
        content: `🔔 **New Midman Request** - ${
          partnerUser ? "✅ Partner Found" : "⚠️ Partner Not Found"
        }`,
        embeds: [adminEmbed],
        components: [adminRow],
      });

      console.log(`✅ Admin notification sent: ${adminMessage.id}`);
    } catch (error) {
      console.error("❌ Error sending admin notification:", error);
      return interaction.editReply({
        content:
          "❌ Gagal mengirim notifikasi ke admin. Request telah disimpan, namun admin mungkin tidak menerima notifikasi. Silakan hubungi admin secara manual.",
        ephemeral: true,
      });
    }

    // Create enhanced user confirmation embed
    const userEmbed = new EmbedBuilder()
      .setTitle("✅ Midman Request Submitted")
      .setDescription(
        `Request midman Anda telah berhasil dikirim ke admin!\n\n` +
          `**Transaction ID:** \`${transactionId}\`\n` +
          `**Partner:** ${partnerName}\n` +
          `**Partner Status:** ${getPartnerStatusForUser(
            partnerValidationStatus
          )}\n` +
          `**Amount:** Rp ${amount.toLocaleString("id-ID")}\n` +
          `**Description:** ${transactionDescription}\n\n` +
          `🕐 **Next Steps:**\n` +
          `• Tunggu admin untuk approve request Anda\n` +
          `• Channel transaksi akan dibuat otomatis setelah diapprove\n` +
          `• Anda akan mendapat notifikasi melalui DM\n` +
          `${
            partnerUser
              ? "• Partner akan otomatis ditambahkan ke channel"
              : "• Partner perlu diundang manual ke channel"
          }\n\n` +
          `📋 **Request Details:**\n` +
          `• Submitted: <t:${Math.floor(Date.now() / 1000)}:R>\n` +
          `• Status: ⏳ Pending Approval\n` +
          `• Estimated processing: 5-30 minutes`
      )
      .setColor(0x00ae86)
      .setFooter({
        text: "RBLX Syndicate - Midman Service | Save this Transaction ID",
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Add warning if partner not found
    if (partnerValidationStatus !== "found") {
      userEmbed.addFields({
        name: "⚠️ Partner Notice",
        value:
          "Partner tidak dapat ditemukan otomatis. Admin akan perlu mengundang partner secara manual ke channel transaksi.",
        inline: false,
      });
    }

    await interaction.editReply({
      embeds: [userEmbed],
      ephemeral: true,
    });

    console.log("=== Midman Request Processing Complete ===");
    console.log(`Request ID: ${transactionId}`);
    console.log(`Requester: ${interaction.user.tag}`);
    console.log(`Partner Status: ${partnerValidationStatus}`);
    console.log(`Amount: Rp ${amount.toLocaleString("id-ID")}`);
  } catch (error) {
    console.error("❌ Error handling midman modal:", error);
    console.error("Error stack:", error.stack);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ System Error")
      .setDescription(
        "Terjadi kesalahan sistem saat memproses request midman Anda.\n\n" +
          "**Kemungkinan Penyebab:**\n" +
          "• Server sedang sibuk\n" +
          "• Koneksi database bermasalah\n" +
          "• Input data tidak valid\n\n" +
          "**Silakan coba lagi dalam beberapa menit atau hubungi admin.**"
      )
      .setColor(0xff0000)
      .setFooter({ text: "RBLX Syndicate - Error Handler" })
      .setTimestamp();

    try {
      await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    } catch (replyError) {
      console.error("❌ Error sending error reply:", replyError);
      // Fallback: try simple text reply
      try {
        await interaction.editReply({
          content:
            "❌ Terjadi kesalahan sistem. Silakan coba lagi dalam beberapa menit atau hubungi admin.",
          ephemeral: true,
        });
      } catch (fallbackError) {
        console.error("❌ Critical: Could not send any reply:", fallbackError);
      }
    }
  }
};

// Helper function untuk format partner validation text untuk admin
function getPartnerValidationText(status, inputId, partnerUser) {
  switch (status) {
    case "found":
      return `✅ **Valid Partner Found**\n\`${partnerUser.tag}\` (${partnerUser.id})`;
    case "not_found":
      return `❌ **Partner Not Found**\nInput: \`${inputId}\`\nUser tidak ditemukan di server atau cache`;
    case "invalid_format":
      return `⚠️ **Invalid ID Format**\nInput: \`${inputId}\`\nFormat ID tidak valid (harus berupa Discord ID atau mention)`;
    case "error":
      return `🔴 **Fetch Error**\nInput: \`${inputId}\`\nTerjadi error saat mencari user`;
    default:
      return `❓ **Unknown Status**\nInput: \`${inputId}\``;
  }
}

// Helper function untuk format partner status untuk user
function getPartnerStatusForUser(status) {
  switch (status) {
    case "found":
      return "✅ Found & Verified";
    case "not_found":
      return "❌ Not Found";
    case "invalid_format":
      return "⚠️ Invalid Format";
    case "error":
      return "🔴 Verification Error";
    default:
      return "❓ Unknown";
  }
}
