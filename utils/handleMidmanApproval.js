// utils/handleMidmanApproval.js
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  async approveMidman(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const transactionId = interaction.customId.split("_")[2];

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
        return interaction.editReply({
          content: "❌ Gagal memuat data request midman.",
          ephemeral: true,
        });
      }

      const requestIndex = requests.findIndex(
        (req) => req.id === transactionId
      );
      if (requestIndex === -1) {
        return interaction.editReply({
          content: "❌ Request midman tidak ditemukan.",
          ephemeral: true,
        });
      }

      const request = requests[requestIndex];

      if (request.status !== "pending_approval") {
        return interaction.editReply({
          content: "❌ Request ini sudah diproses sebelumnya.",
          ephemeral: true,
        });
      }

      // Update request status
      request.status = "approved";
      request.adminId = interaction.user.id;
      request.approvedAt = new Date().toISOString();

      // Create midman transaction channel
      const guild = interaction.guild;
      const channelName = `midman-${transactionId.toLowerCase()}`;

      // Get users for channel permissions
      const requester = await interaction.client.users.fetch(
        request.requester.id
      );
      let partner = null;

      if (request.partner.id) {
        try {
          partner = await interaction.client.users.fetch(request.partner.id);
        } catch (error) {
          console.log("Could not fetch partner user:", error.message);
        }
      }

      // Create channel with proper permissions
      const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Midman Transaction: ${request.transaction.description} | ID: ${transactionId}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: request.requester.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: interaction.user.id, // Admin who approved
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
        ],
      };

      // Add partner permissions if found
      if (partner) {
        channelOptions.permissionOverwrites.push({
          id: partner.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }

      const transactionChannel = await guild.channels.create(channelOptions);

      // Update request with channel ID
      request.channelId = transactionChannel.id;

      // Save updated requests
      try {
        await fs.promises.writeFile(
          midmanPath,
          JSON.stringify(requests, null, 2)
        );
      } catch (error) {
        console.error("Error saving updated midman request:", error);
      }

      // Create welcome embed for transaction channel
      const welcomeEmbed = new EmbedBuilder()
        .setTitle("🤝 Midman Transaction Started")
        .setDescription(
          `Welcome to your midman transaction channel!\n\n` +
            `**Transaction ID:** \`${transactionId}\`\n` +
            `**Requester:** <@${request.requester.id}>\n` +
            `**Partner:** ${
              partner ? `<@${partner.id}>` : request.partner.name
            }\n` +
            `**Amount:** Rp ${request.transaction.amount.toLocaleString(
              "id-ID"
            )}\n` +
            `**Description:** ${request.transaction.description}\n\n` +
            `**Admin:** <@${interaction.user.id}>\n\n` +
            `📋 **Transaction Rules:**\n` +
            `• Follow admin instructions\n` +
            `• Upload proof when required\n` +
            `• Be honest and transparent\n` +
            `• Don't leave the channel until transaction is complete`
        )
        .setColor(0x00ae86)
        .setFooter({ text: "RBLX Syndicate - Midman Service" })
        .setTimestamp();

      const completeButton = new ButtonBuilder()
        .setCustomId(`complete_midman_${transactionId}`)
        .setLabel("✅ Complete Transaction")
        .setStyle(ButtonStyle.Success);

      const cancelTransactionButton = new ButtonBuilder()
        .setCustomId(`cancel_midman_transaction_${transactionId}`)
        .setLabel("❌ Cancel Transaction")
        .setStyle(ButtonStyle.Danger);

      const adminRow = new ActionRowBuilder().addComponents(
        completeButton,
        cancelTransactionButton
      );

      const welcomeMessage = await transactionChannel.send({
        content: `<@${request.requester.id}> ${
          partner ? `<@${partner.id}>` : `@${request.partner.name}`
        } <@${interaction.user.id}>`,
        embeds: [welcomeEmbed],
        components: [adminRow],
      });

      // Pin the welcome message
      await welcomeMessage.pin();

      // Update original admin message
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x00ff00)
        .setTitle("✅ Midman Request Approved")
        .addFields(
          {
            name: "🏛️ Admin",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "📺 Channel",
            value: `<#${transactionChannel.id}>`,
            inline: true,
          }
        );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [],
      });

      // Notify requester
      try {
        const requesterNotifyEmbed = new EmbedBuilder()
          .setTitle("✅ Midman Request Approved!")
          .setDescription(
            `Your midman request has been approved!\n\n` +
              `**Transaction ID:** \`${transactionId}\`\n` +
              `**Channel:** <#${transactionChannel.id}>\n` +
              `**Admin:** <@${interaction.user.id}>\n\n` +
              `Please check the transaction channel to continue.`
          )
          .setColor(0x00ff00)
          .setFooter({ text: "RBLX Syndicate - Midman Service" })
          .setTimestamp();

        await requester.send({ embeds: [requesterNotifyEmbed] });
      } catch (error) {
        console.log("Could not send DM to requester:", error.message);
      }

      // Notify partner if found
      if (partner) {
        try {
          const partnerNotifyEmbed = new EmbedBuilder()
            .setTitle("🤝 You've been added to a Midman Transaction")
            .setDescription(
              `You have been added to a midman transaction!\n\n` +
                `**Transaction ID:** \`${transactionId}\`\n` +
                `**Channel:** <#${transactionChannel.id}>\n` +
                `**Requester:** <@${request.requester.id}>\n` +
                `**Admin:** <@${interaction.user.id}>\n\n` +
                `Please check the transaction channel for details.`
            )
            .setColor(0x00ae86)
            .setFooter({ text: "RBLX Syndicate - Midman Service" })
            .setTimestamp();

          await partner.send({ embeds: [partnerNotifyEmbed] });
        } catch (error) {
          console.log("Could not send DM to partner:", error.message);
        }
      }

      await interaction.editReply({
        content: `✅ Midman request approved! Channel created: <#${transactionChannel.id}>`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error approving midman:", error);
      try {
        await interaction.editReply({
          content: "❌ Terjadi kesalahan saat approve midman request.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("Error sending error reply:", replyError);
      }
    }
  },

  async rejectMidman(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const transactionId = interaction.customId.split("_")[2];

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
        return interaction.editReply({
          content: "❌ Gagal memuat data request midman.",
          ephemeral: true,
        });
      }

      const requestIndex = requests.findIndex(
        (req) => req.id === transactionId
      );
      if (requestIndex === -1) {
        return interaction.editReply({
          content: "❌ Request midman tidak ditemukan.",
          ephemeral: true,
        });
      }

      const request = requests[requestIndex];

      if (request.status !== "pending_approval") {
        return interaction.editReply({
          content: "❌ Request ini sudah diproses sebelumnya.",
          ephemeral: true,
        });
      }

      // Update request status
      request.status = "rejected";
      request.adminId = interaction.user.id;
      request.rejectedAt = new Date().toISOString();

      // Save updated requests
      try {
        await fs.promises.writeFile(
          midmanPath,
          JSON.stringify(requests, null, 2)
        );
      } catch (error) {
        console.error("Error saving updated midman request:", error);
      }

      // Update original admin message
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xff0000)
        .setTitle("❌ Midman Request Rejected")
        .addFields({
          name: "🏛️ Admin",
          value: `<@${interaction.user.id}>`,
          inline: true,
        });

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [],
      });

      // Notify requester
      try {
        const requester = await interaction.client.users.fetch(
          request.requester.id
        );
        const rejectNotifyEmbed = new EmbedBuilder()
          .setTitle("❌ Midman Request Rejected")
          .setDescription(
            `Your midman request has been rejected by admin.\n\n` +
              `**Transaction ID:** \`${transactionId}\`\n` +
              `**Admin:** <@${interaction.user.id}>\n\n` +
              `Please contact admin for more information or submit a new request.`
          )
          .setColor(0xff0000)
          .setFooter({ text: "RBLX Syndicate - Midman Service" })
          .setTimestamp();

        await requester.send({ embeds: [rejectNotifyEmbed] });
      } catch (error) {
        console.log("Could not send DM to requester:", error.message);
      }

      await interaction.editReply({
        content: "❌ Midman request rejected and user notified.",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error rejecting midman:", error);
      try {
        await interaction.editReply({
          content: "❌ Terjadi kesalahan saat reject midman request.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("Error sending error reply:", replyError);
      }
    }
  },
};
