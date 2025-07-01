// utils/adminHelper.js
const fs = require("fs");
const path = require("path");

const adminStatusPath = path.join(__dirname, "../data/adminStatus.json");

// Function to get admin status
function getAdminStatus() {
  try {
    if (fs.existsSync(adminStatusPath)) {
      const data = fs.readFileSync(adminStatusPath, "utf8");
      return JSON.parse(data);
    }
    // Default admin status structure
    return {
      admins: {
        // Format: "userId": { name: "Admin Name", isActive: false, payments: ["QRIS", "DANA"] }
      },
    };
  } catch (error) {
    console.error("Error reading adminStatus.json:", error);
    return { admins: {} };
  }
}

// Function to save admin status
function saveAdminStatus(adminStatus) {
  try {
    fs.writeFileSync(adminStatusPath, JSON.stringify(adminStatus, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving adminStatus.json:", error);
    return false;
  }
}

// Function to toggle admin status
function toggleAdminStatus(userId, username) {
  try {
    const adminStatus = getAdminStatus();

    if (!adminStatus.admins[userId]) {
      // First time, add admin with default settings
      adminStatus.admins[userId] = {
        name: username,
        isActive: true,
        payments: ["QRIS", "DANA", "OVO", "GOJEK"],
      };
    } else {
      // Toggle existing admin
      adminStatus.admins[userId].isActive =
        !adminStatus.admins[userId].isActive;
      adminStatus.admins[userId].name = username; // Update name in case it changed
    }

    return saveAdminStatus(adminStatus) ? adminStatus.admins[userId] : null;
  } catch (error) {
    console.error("Error toggling admin status:", error);
    return null;
  }
}

// Function to get active admins
function getActiveAdmins() {
  try {
    const adminStatus = getAdminStatus();
    const activeAdmins = {};

    for (const [userId, admin] of Object.entries(adminStatus.admins)) {
      if (admin.isActive) {
        activeAdmins[userId] = admin;
      }
    }

    return activeAdmins;
  } catch (error) {
    console.error("Error getting active admins:", error);
    return {};
  }
}

// Function to check if admin is active
function isAdminActive(userId) {
  try {
    const adminStatus = getAdminStatus();
    return adminStatus.admins[userId]?.isActive || false;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Function to update admin payment methods
function updateAdminPayments(userId, payments) {
  try {
    const adminStatus = getAdminStatus();

    if (adminStatus.admins[userId]) {
      adminStatus.admins[userId].payments = payments;
      return saveAdminStatus(adminStatus);
    }

    return false;
  } catch (error) {
    console.error("Error updating admin payments:", error);
    return false;
  }
}

module.exports = {
  getAdminStatus,
  saveAdminStatus,
  toggleAdminStatus,
  getActiveAdmins,
  isAdminActive,
  updateAdminPayments,
};
