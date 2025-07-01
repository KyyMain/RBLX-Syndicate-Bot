// utils/handleMidmanCompletion.js
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

  // NEW: Add the missing completeMidman function
  async completeMidman(interaction) {
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

      if (request.status !== "approved") {
        return interaction.editReply({
          content: "❌ Transaksi ini belum disetujui atau sudah selesai.",
          ephemeral: true,
        });
      }

      // Update request status
      request.status = "completed";
      request.completedBy = interaction.user.id;
      request.completedAt = new Date().toISOString();

      // Save updated requests
      try {
        await fs.promises.writeFile(
          midmanPath,
          JSON.stringify(requests, null, 2)
        );
      } catch (error) {
        console.error("Error saving updated midman request:", error);
      }

      // Create completion embed
      const completionEmbed = new EmbedBuilder()
        .setTitle("✅ Transaction Completed!")
        .setDescription(
          `**Transaction ID:** \`${transactionId}\`\n` +
            `**Completed by:** <@${interaction.user.id}>\n` +
            `**Completed at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `Thank you for using our midman service! 🎉\n` +
            `This channel will be archived in 5 minutes.`
        )
        .setColor(0x00ff00)
        .setFooter({ text: "RBLX Syndicate - Midman Service" })
        .setTimestamp();

      // Send completion message to the transaction channel
      if (request.channelId) {
        try {
          const transactionChannel = interaction.guild.channels.cache.get(
            request.channelId
          );
          if (transactionChannel) {
            await transactionChannel.send({
              content: `<@${request.requester.id}> ${
                request.partner.id
                  ? `<@${request.partner.id}>`
                  : `@${request.partner.name}`
              }`,
              embeds: [completionEmbed],
            });

            // Archive the channel after 5 minutes
            setTimeout(async () => {
              try {
                await transactionChannel.delete();
              } catch (error) {
                console.error("Error deleting transaction channel:", error);
              }
            }, 5 * 60 * 1000); // 5 minutes
          }
        } catch (error) {
          console.error("Error sending completion message:", error);
        }
      }

      // Notify users via DM
      try {
        const requester = await interaction.client.users.fetch(
          request.requester.id
        );
        const completionNotifyEmbed = new EmbedBuilder()
          .setTitle("✅ Midman Transaction Completed!")
          .setDescription(
            `Your midman transaction has been completed successfully!\n\n` +
              `**Transaction ID:** \`${transactionId}\`\n` +
              `**Amount:** Rp ${request.transaction.amount.toLocaleString(
                "id-ID"
              )}\n` +
              `**Description:** ${request.transaction.description}\n` +
              `**Completed by:** <@${interaction.user.id}>\n\n` +
              `Thank you for using RBLX Syndicate midman service! 🎉`
          )
          .setColor(0x00ff00)
          .setFooter({ text: "RBLX Syndicate - Midman Service" })
          .setTimestamp();

        await requester.send({ embeds: [completionNotifyEmbed] });
      } catch (error) {
        console.log("Could not send DM to requester:", error.message);
      }

      // Notify partner if available
      if (request.partner.id) {
        try {
          const partner = await interaction.client.users.fetch(
            request.partner.id
          );
          const partnerCompletionEmbed = new EmbedBuilder()
            .setTitle("✅ Midman Transaction Completed!")
            .setDescription(
              `The midman transaction you were part of has been completed!\n\n` +
                `**Transaction ID:** \`${transactionId}\`\n` +
                `**Amount:** Rp ${request.transaction.amount.toLocaleString(
                  "id-ID"
                )}\n` +
                `**Description:** ${request.transaction.description}\n` +
                `**Completed by:** <@${interaction.user.id}>\n\n` +
                `Thank you for using RBLX Syndicate midman service! 🎉`
            )
            .setColor(0x00ff00)
            .setFooter({ text: "RBLX Syndicate - Midman Service" })
            .setTimestamp();

          await partner.send({ embeds: [partnerCompletionEmbed] });
        } catch (error) {
          console.log("Could not send DM to partner:", error.message);
        }
      }

      await interaction.editReply({
        content:
          "✅ Transaksi midman berhasil diselesaikan! Semua pihak telah dinotifikasi.",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error completing midman transaction:", error);
      try {
        await interaction.editReply({
          content: "❌ Terjadi kesalahan saat menyelesaikan transaksi midman.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("Error sending error reply:", replyError);
      }
    }
  },

  // NEW: Add the missing cancelMidmanTransaction function
  async cancelMidmanTransaction(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const transactionId = interaction.customId.split("_")[3]; // Note: different split index for cancel_midman_transaction_

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

      if (request.status !== "approved") {
        return interaction.editReply({
          content: "❌ Transaksi ini belum disetujui atau sudah selesai.",
          ephemeral: true,
        });
      }

      // Update request status
      request.status = "cancelled";
      request.cancelledBy = interaction.user.id;
      request.cancelledAt = new Date().toISOString();

      // Save updated requests
      try {
        await fs.promises.writeFile(
          midmanPath,
          JSON.stringify(requests, null, 2)
        );
      } catch (error) {
        console.error("Error saving updated midman request:", error);
      }

      // Create cancellation embed
      const cancellationEmbed = new EmbedBuilder()
        .setTitle("❌ Transaction Cancelled")
        .setDescription(
          `**Transaction ID:** \`${transactionId}\`\n` +
            `**Cancelled by:** <@${interaction.user.id}>\n` +
            `**Cancelled at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `This transaction has been cancelled by admin.\n` +
            `This channel will be deleted in 2 minutes.`
        )
        .setColor(0xff0000)
        .setFooter({ text: "RBLX Syndicate - Midman Service" })
        .setTimestamp();

      // Send cancellation message to the transaction channel
      if (request.channelId) {
        try {
          const transactionChannel = interaction.guild.channels.cache.get(
            request.channelId
          );
          if (transactionChannel) {
            await transactionChannel.send({
              content: `<@${request.requester.id}> ${
                request.partner.id
                  ? `<@${request.partner.id}>`
                  : `@${request.partner.name}`
              }`,
              embeds: [cancellationEmbed],
            });

            // Delete the channel after 2 minutes
            setTimeout(async () => {
              try {
                await transactionChannel.delete();
              } catch (error) {
                console.error("Error deleting transaction channel:", error);
              }
            }, 2 * 60 * 1000); // 2 minutes
          }
        } catch (error) {
          console.error("Error sending cancellation message:", error);
        }
      }

      // Notify users via DM
      try {
        const requester = await interaction.client.users.fetch(
          request.requester.id
        );
        const cancellationNotifyEmbed = new EmbedBuilder()
          .setTitle("❌ Midman Transaction Cancelled")
          .setDescription(
            `Your midman transaction has been cancelled by admin.\n\n` +
              `**Transaction ID:** \`${transactionId}\`\n` +
              `**Amount:** Rp ${request.transaction.amount.toLocaleString(
                "id-ID"
              )}\n` +
              `**Description:** ${request.transaction.description}\n` +
              `**Cancelled by:** <@${interaction.user.id}>\n\n` +
              `Please contact admin for more information or submit a new request.`
          )
          .setColor(0xff0000)
          .setFooter({ text: "RBLX Syndicate - Midman Service" })
          .setTimestamp();

        await requester.send({ embeds: [cancellationNotifyEmbed] });
      } catch (error) {
        console.log("Could not send DM to requester:", error.message);
      }

      // Notify partner if available
      if (request.partner.id) {
        try {
          const partner = await interaction.client.users.fetch(
            request.partner.id
          );
          const partnerCancellationEmbed = new EmbedBuilder()
            .setTitle("❌ Midman Transaction Cancelled")
            .setDescription(
              `The midman transaction you were part of has been cancelled by admin.\n\n` +
                `**Transaction ID:** \`${transactionId}\`\n` +
                `**Amount:** Rp ${request.transaction.amount.toLocaleString(
                  "id-ID"
                )}\n` +
                `**Description:** ${request.transaction.description}\n` +
                `**Cancelled by:** <@${interaction.user.id}>\n\n` +
                `Please contact admin for more information.`
            )
            .setColor(0xff0000)
            .setFooter({ text: "RBLX Syndicate - Midman Service" })
            .setTimestamp();

          await partner.send({ embeds: [partnerCancellationEmbed] });
        } catch (error) {
          console.log("Could not send DM to partner:", error.message);
        }
      }

      await interaction.editReply({
        content:
          "❌ Transaksi midman telah dibatalkan. Semua pihak telah dinotifikasi.",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error cancelling midman transaction:", error);
      try {
        await interaction.editReply({
          content: "❌ Terjadi kesalahan saat membatalkan transaksi midman.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("Error sending error reply:", replyError);
      }
    }
  },
};
