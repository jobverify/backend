import { createHash } from 'node:crypto'
import { readNativeDocument } from './activeNativeHtml.js'

export const TURBOHIRE_CURRENT_PUBLIC_CLIENT = Object.freeze({
  path: '/main.f9eb0b1ea3273f6dfc17.chunk.js',
  sha256: '0a7d40f15e464be2813a0bc042958f2279f53ed092d24769bb511fe701d3edea',
  apiBaseURL: 'https://thapi-stage2.azurewebsites.net',
})

// Both current boards explicitly load this reviewed public service client.
// The native careers service is distinct from its recommendation service.
// Read literal declarations and exact bytes; never execute downloaded code or
// fall back to an older API deployment when the current client changes.
export const verifyTurboHirePublicClient = async ({ source, origin, boardHTML, fetchScript }) => {
  const requireClient = (ok, message) => {
    if (!ok) throw Object.assign(Error(source + ' current TurboHire client: ' + message), { abortRetries: true, incompleteScope: true })
  }
  const doc = readNativeDocument(boardHTML), main = doc.nodes(node => node.tag === 'script' && node.attrs.src
    && new URL(node.attrs.src, origin).origin === origin && /\/main\.[a-f0-9]+\.chunk\.js$/.test(new URL(node.attrs.src, origin).pathname))
  requireClient(main.length === 1 && !Object.hasOwn(main[0].attrs, 'nomodule')
    && (!main[0].attrs.type || /^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(main[0].attrs.type)), 'declared public main client is missing, ambiguous or inert')
  const url = new URL(main[0].attrs.src, origin)
  requireClient(url.href === origin + TURBOHIRE_CURRENT_PUBLIC_CLIENT.path, 'unreviewed current public client URL')
  const body = await fetchScript(url.href)
  const digest = createHash('sha256').update(body).digest('hex')
  requireClient(digest === TURBOHIRE_CURRENT_PUBLIC_CLIENT.sha256, 'current public client bytes changed')
  const service = /class\s+([A-Za-z_$][\w$]*)\{constructor\(\)\{this\.API_SERVER_BASE_URL="(https:[^"]+)"/.exec(body)
  requireClient(service?.[2] === TURBOHIRE_CURRENT_PUBLIC_CLIENT.apiBaseURL
    && body.includes('getPublicJobRefsForOrgFiltered(e,t,a)')
    && body.includes('/api/careerpagev2/filteredjobs?orgId=${e}&pageType=${t}')
    && body.includes('/api/publicjobs?jobId=${e}&fieldVisibility=${t}'), 'reviewed native public service/API binding changed')
  return { url: url.href, sha256: digest, apiBaseURL: service[2] }
}
