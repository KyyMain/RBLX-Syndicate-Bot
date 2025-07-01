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

// Improved utility function untuk safely fetch member dengan retry mechanism
async function safelyFetchMember(guild, userId, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempting to fetch member ${userId} (attempt ${attempt}/${retries})`);
      
      // Coba fetch specific member dulu
      let member = guild.members.cache.get(userId);
      if (member) {
        console.log(`Found member ${userId} in cache: ${member.user.tag}`);
        return member;
      }

      // Jika tidak ada di cache, coba fetch dengan timeout
      try {
        member = await Promise.race([
          guild.members.fetch(userId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), 5000)
          )
        ]);
        
        if (member) {
          console.log(`Successfully fetched member ${userId}: ${member.user.tag}`);
          return member;
        }
      } catch (fetchError) {
        console.log(`Fetch attempt ${attempt} failed for ${userId}:`, fetchError.message);
        
        // Sebagai fallback, coba fetch dengan force dan cache
        if (attempt === retries) {
          try {
            await guild.members.fetch({ user: userId, force: true, cache: true });
            member = guild.members.cache.get(userId);
            if (member) {
              console.log(`Fallback fetch successful for ${userId}: ${member.user.tag}`);
              return member;
            }
          } catch (fallbackError) {
            console.log(`Fallback fetch failed for ${userId}:`, fallbackError.message);
          }
        }
      }

      // Wait before retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (error) {
      console.error(`Error in attempt ${attempt} for safelyFetchMember ${userId}:`, error);
      if (attempt === retries) {
        return null;
      }
    }
  }
  return null;
}

// Improved function untuk parse partner ID dari berbagai format
function parsePartnerId(partnerIdInput) {
  if (!partnerIdInput) return null;

  console.log(`Parsing partner ID: "${partnerIdInput}"`);

  let cleanId = partnerIdInput.trim();
  
  // Remove @ symbol dan mention formatting
  cleanId = cleanId.replace(/[<@!>]/g, "");
  
  // Remove leading @ if exists
  if (cleanId.startsWith("@")) {
    cleanId = cleanId.slice(1);
  }

  console.log(`Cleaned ID: "${cleanId}"`);

  // Cek apakah ini adalah user ID yang valid (angka 17-19 digit)
  if (/^\d{17,19}$/.test(cleanId)) {
    console.log(`Valid Discord ID detected: ${cleanId}`);
    return cleanId;
  }

  console.log(`Invalid ID format: ${cleanId}`);
  return null;
}

// Enhanced function untuk fetch user dengan multiple strategies
async function fetchUserSafely(client, guild, partnerIdInput, retries = 3) {
  const parsedId = parsePartnerId(partnerIdInput);
  
  if (!parsedId) {
    console.log(`Could not parse partner ID: ${partnerIdInput}`);
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching user ${parsedId} (attempt ${attempt}/${retries})`);
      
      // Strategy 1: Try client.users.fetch first
      try {
        const user = await Promise.race([
          client.users.fetch(parsedId, { force: true }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('User fetch timeout')), 5000)
          )
        ]);
        
        if (user) {
          console.log(`Successfully fetched user via client: ${user.tag}`);
          return user;
        }
      } catch (userFetchError) {
        console.log(`Client user fetch failed (attempt ${attempt}):`, userFetchError.message);
      }

      // Strategy 2: Try guild member fetch
      try {
        const member = await safelyFetchMember(guild, parsedId, 1);
        if (member && member.user) {
          console.log(`Successfully fetched user via guild member: ${member.user.tag}`);
          return member.user;
        }
      } catch (memberFetchError) {
        console.log(`Guild member fetch failed (attempt ${attempt}):`, memberFetchError.message);
      }

      // Strategy 3: Check cache
      const cachedUser = client.users.cache.get(parsedId);
      if (cachedUser) {
        console.log(`Found user in cache: ${cachedUser.tag}`);
        return cachedUser;
      }

      // Wait before retry
      if (attempt < retries) {
        console.log(`Waiting before retry attempt ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    } catch (error) {
      console.error(`Error in fetchUserSafely attempt ${attempt}:`, error);
    }
  }

  console.log(`Failed to fetch user after ${retries} attempts: ${partnerIdInput}`);
  return null;
}

module.exports = {
  async approveMidman(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const transactionId = interaction.customId.split("_")[2];
      console.log(`Approving midman transaction: ${transactionId}`);

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

      const guild = interaction.guild;
      const channelName = `midman-${transactionId.toLowerCase()}`;

      // Enhanced user fetching with better error handling
      console.log("=== Starting User Fetching Process ===");

      // Fetch requester
      let requester;
      try {
        console.log(`Fetching requester: ${request.requester.id}`);
        requester = await interaction.client.users.fetch(request.requester.id, { force: true });
        console.log(`✅ Requester fetched: ${requester.tag}`);
      } catch (error) {
        console.error("❌ Failed to fetch requester:", error);
        return interaction.editReply({
          content: "❌ Gagal mengambil data requester.",
          ephemeral: true,
        });
      }

      // Enhanced partner fetching
      let partner = null;
      if (request.partner && request.partner.inputId) {
        console.log(`Attempting to fetch partner: ${request.partner.inputId}`);
        
        partner = await fetchUserSafely(
          interaction.client, 
          guild, 
          request.partner.inputId, 
          3
        );

        if (partner) {
          console.log(`✅ Partner successfully fetched: ${partner.tag} (${partner.id})`);
          // Update partner info in request
          request.partner.id = partner.id;
          request.partner.username = partner.username;
        } else {
          console.log(`❌ Could not fetch partner: ${request.partner.inputId}`);
        }
      } else {
        console.log("No partner ID provided or invalid partner data");
      }

      console.log("=== User Fetching Complete ===");

      // Create channel with enhanced permissions
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
              PermissionFlagsBits.UseExternalEmojis,
              PermissionFlagsBits.AddReactions,
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
              PermissionFlagsBits.UseExternalEmojis,
              PermissionFlagsBits.AddReactions,
              PermissionFlagsBits.ManageChannels,
            ],
          },
          {
            id: interaction.client.user.id, // Bot itself
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.UseExternalEmojis,
              PermissionFlagsBits.AddReactions,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      };

      // Add partner permissions if partner was found
      if (partner) {
        console.log(`Adding channel permissions for partner: ${partner.tag}`);
        channelOptions.permissionOverwrites.push({
          id: partner.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.AddReactions,
          ],
        });
      }

      // Create the channel
      console.log("Creating transaction channel...");
      const transactionChannel = await guild.channels.create(channelOptions);
      console.log(`✅ Channel created: ${transactionChannel.name} (${transactionChannel.id})`);

      // Update request with channel ID
      request.channelId = transactionChannel.id;

      // Save updated requests
      try {
        await fs.promises.writeFile(
          midmanPath,
          JSON.stringify(requests, null, 2)
        );
        console.log("✅ Request data saved successfully");
      } catch (error) {
        console.error("❌ Error saving updated midman request:", error);
      }

      // Create enhanced welcome embed
      const welcomeEmbed = new EmbedBuilder()
        .setTitle("🤝 Midman Transaction Started")
        .setDescription(
          `Welcome to your midman transaction channel!\n\n` +
            `**Transaction ID:** \`${transactionId}\`\n` +
            `**Requester:** <@${request.requester.id}>\n` +
            `**Partner:** ${
              partner ? `<@${partner.id}> (${partner.tag})` : 
              `${request.partner.name} (ID: ${request.partner.inputId})`
            }\n` +
            `**Amount:** Rp ${request.transaction.amount.toLocaleString(
              "id-ID"
            )}\n` +
            `**Description:** ${request.transaction.description}\n` +
            `${request.transaction.notes !== "Tidak ada" ? `**Notes:** ${request.transaction.notes}\n` : ""}` +
            `**Admin:** <@${interaction.user.id}>\n\n` +
            `📋 **Transaction Rules:**\n` +
            `• Follow admin instructions at all times\n` +
            `• Upload proof when required\n` +
            `• Be honest and transparent\n` +
            `• Don't leave the channel until transaction is complete\n` +
            `• Report any issues immediately to admin\n\n` +
            `🔒 **Security Notice:** This channel is monitored and logged for security purposes.`
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

      // Prepare enhanced content string
      let contentMentions = `<@${request.requester.id}>`;
      if (partner) {
        contentMentions += ` <@${partner.id}>`;
      }
      contentMentions += ` <@${interaction.user.id}>`;

      // Send welcome message with retries
      let welcomeMessage;
      try {
        welcomeMessage = await transactionChannel.send({
          content: `${contentMentions}\n\n**🎉 Transaction channel created successfully!**\n${partner ? "✅ All participants have been added." : "⚠️ Partner could not be automatically added - please invite them manually."}`,
          embeds: [welcomeEmbed],
          components: [adminRow],
        });

        // Pin the welcome message
        try {
          await welcomeMessage.pin();
          console.log("✅ Welcome message pinned successfully");
        } catch (pinError) {
          console.log("❌ Could not pin message:", pinError.message);
        }
      } catch (sendError) {
        console.error("❌ Error sending welcome message:", sendError);
      }

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
          },
          {
            name: "👥 Partner Status",
            value: partner ? "✅ Added successfully" : "⚠️ Could not add automatically",
            inline: true,
          }
        );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [],
      });

      // Enhanced notifications with error handling
      console.log("=== Sending Notifications ===");

      // Notify requester
      try {
        const requesterNotifyEmbed = new EmbedBuilder()
          .setTitle("✅ Midman Request Approved!")
          .setDescription(
            `Your midman request has been approved!\n\n` +
              `**Transaction ID:** \`${transactionId}\`\n` +
              `**Channel:** <#${transactionChannel.id}>\n` +
              `**Admin:** <@${interaction.user.id}>\n` +
              `**Partner:** ${partner ? `${partner.tag} has been added` : "Please invite your partner manually"}\n\n` +
              `Please check the transaction channel to continue.`
          )
          .setColor(0x00ff00)
          .setFooter({ text: "RBLX Syndicate - Midman Service" })
          .setTimestamp();

        await requester.send({ embeds: [requesterNotifyEmbed] });
        console.log("✅ Requester notification sent");
      } catch (error) {
        console.log("❌ Could not send DM to requester:", error.message);
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
                `**Admin:** <@${interaction.user.id}>\n` +
                `**Amount:** Rp ${request.transaction.amount.toLocaleString("id-ID")}\n\n` +
                `Please check the transaction channel for details and follow admin instructions.`
            )
            .setColor(0x00ae86)
            .setFooter({ text: "RBLX Syndicate - Midman Service" })
            .setTimestamp();

          await partner.send({ embeds: [partnerNotifyEmbed] });
          console.log("✅ Partner notification sent");
        } catch (error) {
          console.log("❌ Could not send DM to partner:", error.message);
        }
      }

      console.log("=== Approval Process Complete ===");

      const responseMessage = partner 
        ? `✅ Midman request approved! Channel created: <#${transactionChannel.id}>\n✅ Partner ${partner.tag} has been added successfully.`
        : `✅ Midman request approved! Channel created: <#${transactionChannel.id}>\n⚠️ Partner could not be added automatically. Please invite them manually.`;

      await interaction.editReply({
        content: responseMessage,
        ephemeral: true,
      });
    } catch (error) {
      console.error("❌ Error approving midman:", error);
      console.error("Error stack:", error.stack);
      
      try {
        await interaction.editReply({
          content: `❌ Terjadi kesalahan saat approve midman request: ${error.message}`,
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("❌ Error sending error reply:", replyError);
      }
    }
  },

  async rejectMidman(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const transactionId = interaction.customId.split("_")[2];
      console.log(`Rejecting midman transaction: ${transactionId}`);

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

      // Enhanced requester notification
      try {
        const requester = await interaction.client.users.fetch(
          request.requester.id
        );
        const rejectNotifyEmbed = new EmbedBuilder()
          .setTitle("❌ Midman Request Rejected")
          .setDescription(
            `Your midman request has been rejected by admin.\n\n` +
              `**Transaction ID:** \`${transactionId}\`\n` +
              `**Admin:** <@${interaction.user.id}>\n` +
              `**Reason:** Please contact admin for more information\n\n` +
              `You may submit a new request after addressing any issues with the admin.`
          )
          .setColor(0xff0000)
          .setFooter({ text: "RBLX Syndicate - Midman Service" })
          .setTimestamp();

        await requester.send({ embeds: [rejectNotifyEmbed] });
        console.log("✅ Rejection notification sent to requester");
      } catch (error) {
        console.log("❌ Could not send DM to requester:", error.message);
      }

      await interaction.editReply({
        content: "❌ Midman request rejected and user notified.",
        ephemeral: true,
      });
    } catch (error) {
      console.error("❌ Error rejecting midman:", error);
      try {
        await interaction.editReply({
          content: "❌ Terjadi kesalahan saat reject midman request.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error("❌ Error sending error reply:", replyError);
      }
    }
  },

  // Export utility functions for use in other modules
  safelyFetchMember,
  parsePartnerId,
  fetchUserSafely,
};