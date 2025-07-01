const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User],
});

client.once("ready", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
  console.log(`Bot ID: ${client.user.id}`);
  console.log(`Servers: ${client.guilds.cache.size}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const [command, ...args] = message.content.trim().split(/\s+/);

  try {
    if (command === "!pricelist") {
      require("./commands/pricelist")(message);
    }

    if (command === "!order") {
      require("./commands/order")(message, args);
    }

    if (command === "!editstock") {
      require("./commands/editstock")(message, args);
    }

    if (command === "!addstock") {
      require("./commands/addstock")(message, args);
    }

    if (command === "!admin") {
      require("./commands/admin")(message, args);
    }

    if (command === "!status") {
      require("./commands/status")(message);
    }

    // NEW: Midman command - FIXED
    if (command === "!midman") {
      require("./commands/midman")(message, args);
    }
  } catch (error) {
    console.error("Error in message handler:", error);
    message.reply(
      "❌ Terjadi kesalahan saat memproses perintah. Silakan coba lagi."
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    console.log(`Modal submission: ${customId}`);

    try {
      // Handle midman form submission
      if (customId.startsWith("midman_form_")) {
        return require("./utils/handleMidmanModal")(interaction);
      }
    } catch (error) {
      console.error("Error in modal handler:", error);
      try {
        await interaction.reply({
          content:
            "❌ Terjadi kesalahan saat memproses form. Silakan coba lagi.",
          flags: 64,
        });
      } catch (replyError) {
        console.error("Error sending modal error reply:", replyError);
      }
    }
    return;
  }

  if (!interaction.isButton()) return;

  const id = interaction.customId;
  console.log(`Button interaction: ${id}`); // Debug log

  try {
    // NEW: Handle midman modal show
    if (id.startsWith("show_midman_modal_")) {
      const {
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
        ActionRowBuilder,
      } = require("discord.js");

      const modal = new ModalBuilder()
        .setCustomId(`midman_form_${interaction.user.id}`)
        .setTitle("📋 Request Midman Service");

      const partnerInput = new TextInputBuilder()
        .setCustomId("partner_name")
        .setLabel("Nama Partner (Pembeli/Penjual)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Masukkan nama partner transaksi...")
        .setRequired(true)
        .setMaxLength(100);

      const amountInput = new TextInputBuilder()
        .setCustomId("transaction_amount")
        .setLabel("Nominal Transaksi")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Contoh: 50000")
        .setRequired(true)
        .setMaxLength(20);

      const descriptionInput = new TextInputBuilder()
        .setCustomId("transaction_description")
        .setLabel("Deskripsi Transaksi")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Jelaskan detail transaksi (item, quantity, dll)...")
        .setRequired(true)
        .setMaxLength(500);

      const partnerIdInput = new TextInputBuilder()
        .setCustomId("partner_id")
        .setLabel("Discord ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("contoh:123456789012345678")
        .setRequired(true)
        .setMaxLength(100);

      const notesInput = new TextInputBuilder()
        .setCustomId("additional_notes")
        .setLabel("Catatan Tambahan (Opsional)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Catatan khusus untuk admin...")
        .setRequired(false)
        .setMaxLength(300);

      const firstActionRow = new ActionRowBuilder().addComponents(partnerInput);
      const secondActionRow = new ActionRowBuilder().addComponents(amountInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(
        descriptionInput
      );
      const fourthActionRow = new ActionRowBuilder().addComponents(
        partnerIdInput
      );
      const fifthActionRow = new ActionRowBuilder().addComponents(notesInput);

      modal.addComponents(
        firstActionRow,
        secondActionRow,
        thirdActionRow,
        fourthActionRow,
        fifthActionRow
      );

      await interaction.showModal(modal);
      return;
    }

    // NEW: Handle midman cancel
    if (id.startsWith("cancel_midman_")) {
      await interaction.update({
        content: "❌ Request midman dibatalkan.",
        embeds: [],
        components: [],
      });
      return;
    }

    // NEW: Handle midman approval/rejection
    if (id.startsWith("approve_midman_")) {
      return require("./utils/handleMidmanApproval").approveMidman(interaction);
    }

    if (id.startsWith("reject_midman_")) {
      return require("./utils/handleMidmanApproval").rejectMidman(interaction);
    }

    // NEW: Handle midman completion/cancellation
    if (id.startsWith("complete_midman_")) {
      return require("./utils/handleMidmanCompletion").completeMidman(
        interaction
      );
    }

    if (id.startsWith("cancel_midman_transaction_")) {
      return require("./utils/handleMidmanCompletion").cancelMidmanTransaction(
        interaction
      );
    }

    // Handle admin selection
    if (id.startsWith("select_admin_")) {
      return require("./utils/handleAdminSelection")(interaction);
    }

    // Handle back to admin selection
    if (id.startsWith("back_admin_selection_")) {
      const [_, __, ___, itemKey, jumlah] = id.split("_");
      return require("./utils/selectPayment")(
        { author: interaction.user, reply: () => {} },
        itemKey,
        parseInt(jumlah)
      );
    }

    // Handle cancel order
    if (id.startsWith("cancel_order_")) {
      await interaction.update({
        content: "❌ Pesanan dibatalkan.",
        embeds: [],
        components: [],
      });
      return;
    }

    // Handle payment method selection - DIPERBAIKI untuk format baru
    if (id.startsWith("pay|")) {
      return require("./utils/handlePaymentChoice")(interaction);
    }

    // Handle user payment proof upload - DIPERBAIKI untuk format baru
    if (id.startsWith("user_paid|")) {
      return require("./utils/userUploadProof")(interaction);
    }

    // Handle cancel payment - DIPERBAIKI untuk format baru
    if (id.startsWith("cancel_payment|")) {
      return require("./utils/cancelPayment")(interaction);
    }

    // Handle admin payment approval
    if (id.startsWith("approve_payment_")) {
      const adminPaymentHandler = require("./utils/adminPaymentHandler");
      if (adminPaymentHandler.approvePayment) {
        return adminPaymentHandler.approvePayment(interaction);
      } else {
        throw new Error(
          "approvePayment method not found in adminPaymentHandler"
        );
      }
    }

    // Handle admin payment rejection
    if (id.startsWith("reject_payment_")) {
      const adminPaymentHandler = require("./utils/adminPaymentHandler");
      if (adminPaymentHandler.rejectPayment) {
        return adminPaymentHandler.rejectPayment(interaction);
      } else {
        await interaction.reply({
          content: "❌ Fitur reject payment belum diimplementasi.",
          flags: 64,
        });
      }
    }

    // Handle transaction viewing
    if (id.startsWith("view_transaction_")) {
      const adminPaymentHandler = require("./utils/adminPaymentHandler");
      if (adminPaymentHandler.viewTransaction) {
        return adminPaymentHandler.viewTransaction(interaction);
      } else {
        await interaction.reply({
          content: "❌ Fitur view transaction belum diimplementasi.",
          flags: 64,
        });
      }
    }

    // Legacy handlers for backward compatibility (format lama dengan underscore)
    if (id.startsWith("pay_")) {
      return require("./utils/handlePaymentChoice")(interaction);
    }

    if (id.startsWith("user_paid_")) {
      return require("./utils/userUploadProof")(interaction);
    }

    if (id.startsWith("cancel_payment_")) {
      return require("./utils/cancelPayment")(interaction);
    }

    if (id.startsWith("admin_paid_")) {
      return require("./utils/adminPaid")(interaction);
    }

    // Direct purchase without payment (legacy)
    if (
      id.includes("_") &&
      !id.startsWith("pay_") &&
      !id.startsWith("pay|") &&
      !id.startsWith("user_paid_") &&
      !id.startsWith("user_paid|") &&
      !id.startsWith("approve_") &&
      !id.startsWith("reject_") &&
      !id.startsWith("view_") &&
      !id.startsWith("cancel_") &&
      !id.startsWith("select_admin_") &&
      !id.startsWith("back_admin_") &&
      !id.startsWith("show_midman_") &&
      !id.startsWith("complete_midman_") &&
      !id.startsWith("cancel_midman_")
    ) {
      return require("./utils/updateStock")(interaction);
    }

    // If no handler matches, log it
    console.log(`Unhandled button interaction: ${id}`);
    await interaction.reply({
      content: "❌ Interaksi tidak dikenali. Silakan coba lagi.",
      flags: 64,
    });
  } catch (error) {
    console.error("Error in interaction handler:", error);
    console.error("Error details:", {
      customId: id,
      errorMessage: error.message,
      stack: error.stack,
    });

    const errorMessage =
      "❌ Terjadi kesalahan saat memproses interaksi. Silakan coba lagi atau hubungi admin.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: errorMessage,
          components: [],
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Error sending error response:", replyError);
    }
  }
});

// Error handling untuk uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Login bot
client.login(config.token).catch((error) => {
  console.error("Failed to login:", error);
  process.exit(1);
});
