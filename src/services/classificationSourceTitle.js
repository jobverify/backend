import { createHash } from 'node:crypto'

// Some ATS captures put the entire page into the title. Use a second employer
// source only when page content is evident, keeping the raw capture untouched.
export function recoverClassificationSourceTitle(job = {}) {
  const original = String(job.originalTitle || job.title || '')
  if (original.length <= 512) return null
  const jazzPage = /job\s+(?:summary|description)|key\s+responsibilities|body\s*\{|var\s+DV_|#resumator-/i.test(original)
  const icimsNarrative = /^(?:key\s+responsibilities|success\s+measures)\s*:/i.test(original.trim())
  if (!jazzPage && !icimsNarrative) return null
  for (const sourceField of ['sourceUrl', 'applyUrl', 'link']) {
    try {
      const value = job[sourceField]
      const url = new URL(value)
      if (url.protocol !== 'https:') continue
      let provider, slug
      if (jazzPage && (url.hostname === 'applytojob.com' || url.hostname.endsWith('.applytojob.com'))) {
        provider = 'JazzHR'
        slug = url.pathname.match(/^\/apply\/[a-zA-Z0-9]+\/([^/]+)\/?$/)?.[1]
      } else if (icimsNarrative && !url.username && !url.password
        && (url.hostname === 'icims.com' || url.hostname.endsWith('.icims.com'))) {
        provider = 'iCIMS'
        slug = url.pathname.match(/^\/jobs\/\d+\/([^/]+)(?:\/null)?\/?$/)?.[1]
      }
      if (!slug) continue
      const decoded = decodeURIComponent(slug)
      if (/[<>\r\n]/.test(decoded)) continue
      const recoveredTitle = decoded.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (!/[\p{L}]/u.test(recoveredTitle) || Buffer.byteLength(recoveredTitle, 'utf8') > 240 || /[<>\r\n]/.test(recoveredTitle)) continue
      return { provider, sourceField, recoveredTitle,
        originalTitleCharacters: original.length,
        sourceValueHash: createHash('sha256').update(JSON.stringify([original, value])).digest('hex') }
    } catch {}
  }
  return null
}
