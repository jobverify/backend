import mongoose from 'mongoose';

// Storage compatibility only: retired features have no models, routes or workers.
// Keep owner deletion effective for records written before their removal.
const collections = ['campaigns', 'outreachtasks', 'outreachthreads', 'gmailconnections', 'gmailoauthstates', 'applicationmailboxes', 'applicationmailboxauths', 'applicationmails'];

export async function removeRetiredAccountData(userId, collection = name => mongoose.connection.collection(name)) {
  if (!mongoose.isObjectIdOrHexString(userId)) throw new Error('A valid user ID is required for retired data cleanup.');
  const user = new mongoose.Types.ObjectId(String(userId));
  for (const name of collections) await collection(name).deleteMany({ user });
}
