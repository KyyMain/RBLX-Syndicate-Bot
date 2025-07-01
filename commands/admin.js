// commands/admin.js
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { toggleAdminStatus, getActiveAdmins } = require("../utils/adminHelper");

module.exports = async (message, args) => {
  if (
    !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    return message.reply("❌ Hanya admin yang bisa menggunakan command ini.");
  }

  const subCommand = args[0];

  if (subCommand === "toggle") {
    // Toggle status admin
    const result = toggleAdminStatus(
      message.author.id,
      message.author.username
    );

    if (result) {
      const statusText = result.isActive ? "🟢 AKTIF" : "🔴 TIDAK AKTIF";
      const embed = new EmbedBuilder()
        .setTitle("✅ Status Admin Diubah")
        .setDescription(
          `Status admin **${result.name}** sekarang: ${statusText}`
        )
        .setColor(result.isActive ? 0x00ff00 : 0xff0000)
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } else {
      message.reply("❌ Gagal mengubah status admin.");
    }
  } else if (subCommand === "list") {
    // List semua admin dan status mereka
    const activeAdmins = getActiveAdmins();

    let description = "";
    if (Object.keys(activeAdmins).length === 0) {
      description = "❌ Tidak ada admin yang aktif saat ini.";
    } else {
      description = "🟢 **Admin Yang Aktif:**\n\n";
      for (const [userId, admin] of Object.entries(activeAdmins)) {
        description += `👤 **${admin.name}** (<@${userId}>)\n`;
        description += `💳 Payment: ${admin.payments.join(", ")}\n\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Status Admin")
      .setDescription(description)
      .setColor(0x3399ff)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  } else {
    // Help message
    const embed = new EmbedBuilder()
      .setTitle("📖 Admin Commands")
      .setDescription(
        "**!admin toggle** - Toggle status aktif/tidak aktif\n" +
          "**!admin list** - Lihat daftar admin yang aktif\n" +
          "**!admin help** - Tampilkan help ini"
      )
      .setColor(0x3399ff);

    message.reply({ embeds: [embed] });
  }
};
