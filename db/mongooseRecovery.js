// Compatibility boundary for Mongoose 8.24.4. Public reconnect() replaces the
// live client and can invalidate active transaction sessions. Only call after
// a successful ping on the unchanged live client. Covered by Mongo recovery tests.
export function restoreMongooseReadiness(connection) {
  connection._lastHeartbeatAt = Date.now();
  connection.onOpen();
}
