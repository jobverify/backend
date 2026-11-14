import mongoose from 'mongoose';
import { isProductionEnvironment } from './runtimeConfig.js';

export function assertSecureMongoConnection(uri, env = process.env) {
  if (!isProductionEnvironment(env)) return;

  try {
    // Resolve SRV defaults, SSL aliases, credentials and TLS options with the
    // same driver as the connection. Constructing a client does not connect.
    const { options } = new mongoose.mongo.MongoClient(uri);
    // The driver translates validation-bypass flags into Node TLS options.
    if (options.credentials && options.tls === true
      && options.rejectUnauthorized !== false && options.checkServerIdentity == null
      && env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') return;
  } catch {
    // Driver parse errors can contain URI content. Keep credentials out of logs.
  }

  const error = new Error('Production MongoDB requires authentication and verified TLS.');
  error.code = 'INSECURE_MONGO_CONFIGURATION';
  throw error;
}
