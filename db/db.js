/**
 * @file Database connection utility using Mongoose.
 * @module db/db
 */

import mongoose from "mongoose";
import "../loadEnv.js";
import { configureMongoDns } from "../src/utils/mongoDns.js";
import { restoreMongooseReadiness } from './mongooseRecovery.js';

let connectionAttempt = null;
let connectionAttemptUri = null;

// Connects to the MongoDB database using the loaded connection string.
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error(
      "[Config Error] MONGO_URI is not defined or cannot be accessed in the .env configuration.",
    );
    throw new Error("MONGO_URI environment variable is not defined.");
  }

  const uri = process.env.MONGO_URI;
  const connection = mongoose.connection;
  const liveClient = connection.getClient()?.topology?.isDestroyed() === false;
  // Keep Mongoose's rejection of a different URI on an active connection,
  // including another caller joining an initialization that has not opened yet.
  if (connectionAttempt && connectionAttemptUri !== uri
    || connection._connectionString && connection._connectionString !== uri
      && (connection.readyState === 1 || connection.readyState === 2 || liveClient)) {
    throw new mongoose.Error("Can't use different connection strings on an active MongoDB connection.");
  }
  if (connectionAttempt) return connectionAttempt;
  connectionAttemptUri = uri;
  connectionAttempt = (async () => {
    try {
      if (connection.readyState === 1) return mongoose;
      if (connection.readyState === 2) {
        await connection.asPromise();
        return mongoose;
      }
      // A lost heartbeat also reports disconnected. Opening a new Mongoose
      // connection here replaces the MongoClient underneath in-flight sessions.
      // A live topology still owns recovery; an explicitly closed client has
      // no live topology and may be replaced after its sessions have ended.
      if (connection.db && connection.getClient()?.topology?.isDestroyed() === false) {
        const client = connection.getClient();
        await connection.db.command({ ping: 1 }, { timeoutMS: 30_000 });
        if (connection.getClient() !== client || client.topology?.isDestroyed() !== false
          || connection.readyState === 3) {
          throw new mongoose.mongo.MongoNotConnectedError('MongoDB connection closed during recovery.');
        }
        // Mongoose 8's readyState getter also reports disconnected after a
        // stale heartbeat. The successful ping is fresh contact: restore its
        // readiness clock and flush session/model operations queued meanwhile.
        restoreMongooseReadiness(connection);
        return mongoose;
      }
      configureMongoDns();
      const conn = await mongoose.connect(uri);
      console.log("MongoDB connected:", conn.connection.host);
      return conn;
    } catch (err) {
      console.error("MongoDB connection failed:", err.message);
      throw err;
    }
  })();
  try {
    return await connectionAttempt;
  } finally {
    connectionAttempt = null;
    connectionAttemptUri = null;
  }
};

export default connectDB;
