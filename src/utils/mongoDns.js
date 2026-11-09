import dns from "node:dns";

const parseDnsServers = (value) =>
  String(value || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

export const configureMongoDns = (dnsResolver = dns, env = process.env) => {
  const servers = parseDnsServers(env.MONGO_DNS_SERVERS);
  if (servers.length === 0) {
    return;
  }

  dnsResolver.setServers(servers);
};
