import { unavailable } from './unavailable.js';
export const verificationError = (code, message, status = 422) => Object.assign(new Error(message), { code, status });
// The Node implementation pins validated DNS addresses through undici. Do not
// replace it with unrestricted fetch and silently weaken the SSRF boundary.
export async function fetchPublic() { throw unavailable('Job verification'); }
