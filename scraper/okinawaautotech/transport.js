import https from 'node:https'
import tls from 'node:tls'
import { X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'

// GoDaddy's published R1-to-G2 cross certificate completes the server chain.
// It is not a self-signed trust anchor. Partial-chain trust stays disabled.
export const CROSS_CERTIFICATE_URL = 'https://certs.godaddy.com/repository/gd_tls_root-r1-cross-g2.crt.pem'
export const CROSS_CERTIFICATE_FINGERPRINT = '7B:CB:0F:2F:2D:10:31:A6:AF:8D:61:BA:A8:35:D2:83:5A:3B:8B:CC:26:D9:4A:3B:04:8B:16:55:FB:81:29:8C'
const CROSS_CERTIFICATE = readFileSync(new URL('./certificates/godaddy-tls-r1-cross-g2.pem', import.meta.url), 'utf8')
const G2_FINGERPRINT = '45:14:0B:32:47:EB:9C:C8:C5:B4:F0:D7:B5:30:91:F7:32:92:08:9E:6E:5A:63:E2:74:9D:D3:AC:A9:19:8E:DA'
const ORIGIN = 'https://okinawascooters.com'
const PATHS = new Set(['/career', '/careerdetail.aspx', '/applynow.aspx'])
const validAt = (certificate, now) => Number.isFinite(+now) && +now >= Date.parse(certificate.validFrom) && +now <= Date.parse(certificate.validTo)

export const createOkinawaFetchText = ({
 roots = tls.getCACertificates('default'),
 crossCertificate = CROSS_CERTIFICATE,
 now = () => new Date(),
 get = https.get,
} = {}) => {
 let cross
 try { cross = new X509Certificate(crossCertificate) } catch { throw new Error('Okinawa chain completion certificate is corrupt') }
 if (cross.fingerprint256 !== CROSS_CERTIFICATE_FINGERPRINT || !cross.ca || cross.verify(cross.publicKey))
  throw new Error('Okinawa chain completion certificate identity or issuer changed')
 if (!validAt(cross, now())) throw new Error('Okinawa chain completion certificate is expired or not yet valid')
 const anchor = roots.map(pem => new X509Certificate(pem)).find(root => root.fingerprint256 === G2_FINGERPRINT && root.ca && root.verify(root.publicKey) && cross.checkIssued(root) && cross.verify(root.publicKey) && validAt(root, now()))
 if (!anchor) throw new Error('Okinawa chain completion requires the existing trusted self-signed G2 anchor')
 const ca = [...roots, crossCertificate]
 return async (input, { signal } = {}) => {
  signal?.throwIfAborted()
  const url = new URL(input)
  if (url.origin !== ORIGIN || url.username || url.password || url.hash || !PATHS.has(url.pathname.toLowerCase()))
   throw new Error('Okinawa transport refuses a non-official authority host or path')
  if (!validAt(cross, now()) || !validAt(anchor, now())) throw new Error('Okinawa chain certificate is expired or not yet valid')
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)])
  return new Promise((resolve, reject) => {
   let settled = false
   const finish = (error, value) => {
    if (settled) return
    settled = true
    deadline.removeEventListener('abort', aborted)
    if (error) reject(error); else resolve(value)
   }
   let request
   const aborted = () => { const reason = deadline.reason || new DOMException('Aborted', 'AbortError'); request?.destroy(reason); finish(reason) }
   deadline.addEventListener('abort', aborted, { once: true })
   request = get(url, {
    ca, rejectUnauthorized: true, allowPartialTrustChain: false,
    servername: url.hostname, signal: deadline,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
   }, response => {
    if (response.statusCode >= 300 && response.statusCode < 400) { response.resume(); finish(new Error('Okinawa official transport redirect changed; refusing to follow')); return }
    if (response.statusCode !== 200) { response.resume(); finish(new Error('HTTP ' + response.statusCode + ' for ' + url)); return }
    let body = '', bytes = 0
    response.setEncoding('utf8')
    response.on('data', chunk => { bytes += Buffer.byteLength(chunk); if (bytes > 2 * 1024 * 1024) { request.destroy(new Error('Okinawa native HTML exceeds the verified bounded surface')); return } body += chunk })
    response.on('error', error => finish(error))
    response.on('end', () => finish(null, body))
   })
   request.on('error', error => finish(error))
   if (deadline.aborted) aborted()
  })
 }
}
