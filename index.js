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
  } catch (error) {
    console.error("Error in message handler:", error);
    message.reply(
      "❌ Terjadi kesalahan saat memproses perintah. Silakan coba lagi."
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const id = interaction.customId;
  console.log(`Button interaction: ${id}`); // Debug log

  try {
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
      !id.startsWith("back_admin_")
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
