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

module.exports = async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

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

    // Validate transaction amount
    const amount = parseInt(transactionAmount.replace(/[^\d]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      return interaction.editReply({
        content: "❌ Nominal transaksi tidak valid! Masukkan angka yang benar.",
        ephemeral: true,
      });
    }

    // Parse partner ID (remove @ if exists and extract ID)
    let cleanPartnerId = partnerId.trim();
    if (cleanPartnerId.startsWith("<@") && cleanPartnerId.endsWith(">")) {
      cleanPartnerId = cleanPartnerId.slice(2, -1);
      if (cleanPartnerId.startsWith("!")) {
        cleanPartnerId = cleanPartnerId.slice(1);
      }
    } else if (cleanPartnerId.startsWith("@")) {
      cleanPartnerId = cleanPartnerId.slice(1);
    }

    // Try to find partner user
    let partnerUser = null;
    try {
      // Try to get user by ID first
      if (/^\d+$/.test(cleanPartnerId)) {
        partnerUser = await interaction.client.users.fetch(cleanPartnerId);
      } else {
        // Try to find by username in guild
        const guild = interaction.guild;
        const members = await guild.members.fetch();
        const foundMember = members.find(
          (member) =>
            member.user.username.toLowerCase() ===
              cleanPartnerId.toLowerCase() ||
            member.displayName.toLowerCase() === cleanPartnerId.toLowerCase()
        );
        if (foundMember) {
          partnerUser = foundMember.user;
        }
      }
    } catch (error) {
      console.log("Could not find partner user:", error.message);
    }

    // Generate unique transaction ID
    const transactionId = `MM${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create midman request data
    const midmanRequest = {
      id: transactionId,
      requester: {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
      },
      partner: {
        name: partnerName,
        id: partnerUser ? partnerUser.id : null,
        username: partnerUser ? partnerUser.username : "Unknown",
        inputId: partnerId,
      },
      transaction: {
        amount: amount,
        description: transactionDescription,
        notes: additionalNotes,
      },
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      guildId: interaction.guild.id,
      channelId: null,
      adminId: null,
    };

    // Save to midman requests file
    const midmanPath = path.join(__dirname, "../data/midman_requests.json");
    let requests = [];

    try {
      if (fs.existsSync(midmanPath)) {
        const data = await fs.promises.readFile(midmanPath, "utf8");
        requests = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading midman requests:", error);
      requests = [];
    }

    requests.push(midmanRequest);

    try {
      await fs.promises.writeFile(
        midmanPath,
        JSON.stringify(requests, null, 2)
      );
    } catch (error) {
      console.error("Error saving midman request:", error);
      return interaction.editReply({
        content: "❌ Gagal menyimpan request midman. Silakan coba lagi.",
        ephemeral: true,
      });
    }

    // Send to admin channel for approval
    const adminChannelId = config.adminChannelId;
    const adminChannel = await interaction.client.channels.fetch(
      adminChannelId
    );

    if (!adminChannel) {
      return interaction.editReply({
        content: "❌ Channel admin tidak ditemukan. Hubungi developer.",
        ephemeral: true,
      });
    }

    // Create admin approval embed
    const adminEmbed = new EmbedBuilder()
      .setTitle("🤝 New Midman Request")
      .setColor(0xffa500)
      .addFields(
        {
          name: "📋 Transaction ID",
          value: `\`${transactionId}\``,
          inline: true,
        },
        {
          name: "👤 Requester",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "🤝 Partner",
          value: partnerUser ? `<@${partnerUser.id}>` : partnerName,
          inline: true,
        },
        {
          name: "💰 Amount",
          value: `Rp ${amount.toLocaleString("id-ID")}`,
          inline: true,
        },
        {
          name: "📝 Description",
          value: transactionDescription,
          inline: false,
        },
        {
          name: "📌 Partner Info",
          value: `Input: ${partnerId}\nResolved: ${
            partnerUser
              ? `${partnerUser.username} (${partnerUser.id})`
              : "Not found"
          }`,
          inline: false,
        }
      )
      .setFooter({ text: "RBLX Syndicate - Midman Request" })
      .setTimestamp();

    if (additionalNotes !== "Tidak ada") {
      adminEmbed.addFields({
        name: "📋 Additional Notes",
        value: additionalNotes,
        inline: false,
      });
    }

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

    await adminChannel.send({
      embeds: [adminEmbed],
      components: [adminRow],
    });

    // Confirm to user
    const userEmbed = new EmbedBuilder()
      .setTitle("✅ Midman Request Submitted")
      .setDescription(
        `Request midman Anda telah dikirim ke admin!\n\n` +
          `**Transaction ID:** \`${transactionId}\`\n` +
          `**Partner:** ${partnerName}\n` +
          `**Amount:** Rp ${amount.toLocaleString("id-ID")}\n\n` +
          `Silakan tunggu admin untuk approve request Anda. Channel transaksi akan dibuat otomatis setelah diapprove.`
      )
      .setColor(0x00ae86)
      .setFooter({ text: "RBLX Syndicate - Midman Service" })
      .setTimestamp();

    await interaction.editReply({
      embeds: [userEmbed],
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error handling midman modal:", error);

    try {
      await interaction.editReply({
        content:
          "❌ Terjadi kesalahan saat memproses request midman. Silakan coba lagi.",
        ephemeral: true,
      });
    } catch (replyError) {
      console.error("Error sending error reply:", replyError);
    }
  }
};
