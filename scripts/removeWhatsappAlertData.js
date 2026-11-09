/**
 * Permanently removes the retired WhatsApp alert data from MongoDB.
 *
 * Preview: node scripts/removeWhatsappAlertData.js
 * Apply:   node scripts/removeWhatsappAlertData.js --confirm
 */
import mongoose from "mongoose";
import connectDB from "../db/db.js";

const confirmed = process.argv.includes("--confirm");
const userFields = {
  "premium.whatsappAlertsEnabled": "",
  "profile.whatsappAlertFilters": "",
  "contact.phoneE164": "",
  "contact.whatsappOptInAt": "",
  "contact.whatsappOptOutAt": "",
};
const legacyScheduleFields = { frequency: "", isActive: "", lastSentAt: "", scheduleVersion: "" };

const main = async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const users = db.collection("users");
  const pendingUsers = db.collection("pendingusers");
  const subscriptions = db.collection("subscriptions");
  const deliveries = db.collection("jobalertdeliveries");
  const userQuery = { $or: Object.keys(userFields).map((field) => ({ [field]: { $exists: true } })) };
  const pendingQuery = { "profile.phoneE164": { $exists: true } };
  const scheduleQuery = { $or: Object.keys(legacyScheduleFields).map((field) => ({ [field]: { $exists: true } })) };
  const deliveryQuery = { channel: "whatsapp" };
  const phoneIndexes = (await users.indexes()).filter((index) => Object.hasOwn(index.key, "contact.phoneE164"));

  const counts = {
    users: await users.countDocuments(userQuery),
    pendingUsers: await pendingUsers.countDocuments(pendingQuery),
    subscriptions: await subscriptions.countDocuments(scheduleQuery),
    whatsappDeliveries: await deliveries.countDocuments(deliveryQuery),
    phoneIndexes: phoneIndexes.map((index) => index.name),
  };
  console.log(JSON.stringify({ mode: confirmed ? "apply" : "preview", ...counts }, null, 2));
  if (!confirmed) {
    console.log("Preview only. Re-run with --confirm to permanently remove this data.");
    return;
  }

  const results = {
    users: await users.updateMany(userQuery, { $unset: userFields }),
    pendingUsers: await pendingUsers.updateMany(pendingQuery, { $unset: { "profile.phoneE164": "" } }),
    subscriptions: await subscriptions.updateMany(scheduleQuery, [
      { $set: { telegramSchedule: { $ifNull: ["$telegramSchedule", {
        frequency: { $ifNull: ["$frequency", "immediate"] },
        isActive: { $ifNull: ["$isActive", true] },
        deliveryTime: "09:00", weeklyDay: "monday",
        scheduleVersion: { $ifNull: ["$scheduleVersion", 0] },
      }] } } },
      { $unset: Object.keys(legacyScheduleFields) },
    ]),
    deliveries: await deliveries.deleteMany(deliveryQuery),
  };
  for (const index of phoneIndexes) await users.dropIndex(index.name);
  console.log(JSON.stringify({
    usersModified: results.users.modifiedCount,
    pendingUsersModified: results.pendingUsers.modifiedCount,
    subscriptionsModified: results.subscriptions.modifiedCount,
    whatsappDeliveriesDeleted: results.deliveries.deletedCount,
    phoneIndexesDropped: phoneIndexes.map((index) => index.name),
  }, null, 2));
};

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); });
