const fs = require("fs");
const config = require("../config.json");
let items = require("../data/items.json");
let transactions = require("../data/transactions.json");

module.exports = async (interaction) => {
  const [_, itemKey, jumlahStr, userId, method] =
    interaction.customId.split("_");
  const jumlah = parseInt(jumlahStr);
  const item = items[itemKey];

  // Memeriksa apakah stok cukup
  if (item.stock < jumlah) {
    return interaction.reply({
      content: "❌ Stok tidak mencukupi untuk menyelesaikan transaksi.",
      flags: 64,
    });
  }

  // Mengurangi stok
  item.stock -= jumlah;
  fs.writeFileSync("./data/items.json", JSON.stringify(items, null, 2));

  const user = await interaction.client.users.fetch(userId);

  // Kirim pesan DM ke pengguna dengan penanganan kesalahan
  try {
    await user.send(
      `✅ Pembayaran berhasil dikonfirmasi! Berikut link private server kamu: ${config.privateServerLink}`
    );
  } catch (err) {
    console.error("Failed to send DM:", err);
  }

  // Mengubah status transaksi menjadi "done"
  transactions = transactions.map((tx) =>
    tx.user === userId && tx.item === item.name && tx.status === "pending"
      ? { ...tx, status: "done" }
      : tx
  );
  fs.writeFileSync(
    "./data/transactions.json",
    JSON.stringify(transactions, null, 2)
  );

  // Update interaksi
  await interaction.update({
    content: "✅ Link server telah dikirim ke pembeli.",
    components: [],
  });
};
