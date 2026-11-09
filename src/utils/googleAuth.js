import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

const getGoogleClientId = () => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID ?? "").trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }
  return clientId;
};

export const googleIdentity = {
  async verifyCredential(credential) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: getGoogleClientId(),
    });
    const payload = ticket.getPayload() ?? {};

    return {
      email: String(payload.email ?? ""),
      emailVerified: payload.email_verified === true,
      name: String(payload.name ?? "").trim(),
      picture: payload.picture ? String(payload.picture) : null,
      sub: String(payload.sub ?? ""),
      issuedAt: payload.iat,
      hostedDomain: typeof payload.hd === 'string' ? payload.hd : '',
    };
  },
};

export const verifyGoogleCredential = async (credential) =>
  googleIdentity.verifyCredential(credential);
