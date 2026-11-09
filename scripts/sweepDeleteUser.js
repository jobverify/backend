/**
 * @file Administrative database script to completely remove a user and all associated records.
 * @module scripts/sweepDeleteUser
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env") });

if (process.env.NODE_ENV === "production") {
  console.error("This script cannot be run in production");
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error("Error: Please provide the email address of the user to delete.");
  console.error("  Usage: node scripts/sweepDeleteUser.js email@example.com");
  process.exit(1);
}

const { default: connectDB } = await import("../db/db.js");
const { default: User } = await import("../src/models/User.js");
const { default: PendingUser } = await import("../src/models/PendingUser.js");
const { removeUserAccount } = await import('../src/services/userAccountDeletion.js');

// Connects to the database and executes a cascade delete on the specified email.
const runSweepDelete = async () => {
  try {
    await connectDB();
    console.log(`Starting sweep delete for user: ${email}...`);

    // 1. Delete from PendingUsers (verification limbo)
    const pendingResult = await PendingUser.deleteMany({ email });
    console.log(`- PendingUsers: Deleted ${pendingResult.deletedCount} pending record(s).`);

    // 2. Fetch User from standard Users collection to gather ID
    const user = await User.findOne({ email });
    
    if (user) {
      // Share the API/admin cascade so new private collections cannot be left
      // behind by local maintenance. This also revokes Gmail before deletion.
      await removeUserAccount(user);
      console.log('- Users: Deleted account and all linked private records.');
    } else {
      console.log("- Users: No active account found in the standard Users collection.");
    }

    console.log("✓ Sweep delete completed successfully.");
  } catch (err) {
    process.exitCode = 1;
    console.error("✕ Sweep delete failed:", err.message);
  } finally {
    await mongoose.disconnect();

  }
};

await runSweepDelete();
