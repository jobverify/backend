import { composeAbortSignals } from './fetch.js'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { readNativeDocument } from './activeNativeHtml.js'

const companyHost = url => url.hostname.toLowerCase().replace(/^www\./, '')
const boardIdentity = value => {
  let url
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const parts = url.pathname.split('/').filter(Boolean)
  const publicBoard = identifyPublicAtsBoard(url.href)
  if (publicBoard && parts.length === 1) {
    const region = publicBoard.atsPlatform === 'greenhouse' ? (url.hostname.includes('.eu.') ? ':eu' : ':us')
      : publicBoard.atsPlatform === 'lever' ? `:${publicBoard.region || 'global'}` : ''
    return `${publicBoard.atsPlatform}${region}:${publicBoard.boardToken}`
  }
  if (/^[a-z\d-]+\.wd\d+\.myworkdayjobs\.com$/i.test(url.hostname)) {
    if (/^[a-z]{2}-[a-z]{2}$/i.test(parts[0] || '')) parts.shift()
    if (parts.length === 1) return `workday:${url.hostname}:${parts[0]}`
  }
  return null
}

// Only active anchors can prove the employer's current delegation. Conditional
// object/iframe fallback and hidden markup cannot establish that handoff.
const anchors = html => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href)
  .map(node => node.attrs.href)

const fetchOfficialPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: composeAbortSignals(signal, AbortSignal.timeout(15000)),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)' },
  })
  if (Number(response.headers.get('content-length')) > 3000000) throw new Error('Official careers response is too large')
  const html = await response.text()
  if (html.length > 3000000) throw new Error('Official careers response is too large')
  return { status: response.status, url: response.url, html }
}

export const verifyOfficialAtsBinding = async ({ source, officialUrl, boardUrl }, { fetchPage = fetchOfficialPage, signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetchPage(officialUrl, { signal })
  signal?.throwIfAborted()
  const fail = () => {
    const error = new Error(`[${source}] Current official ATS binding could not be verified at ${officialUrl}`)
    Object.assign(error, { softFailure: true, abortRetries: true, failureKind: 'source_identity_unverified' })
    throw error
  }
  const expected = boardIdentity(boardUrl)
  const official = new URL(officialUrl)
  let finalUrl
  try { finalUrl = new URL(response?.url) } catch { fail() }
  if (!expected || !(response?.status >= 200 && response.status < 300)
    || finalUrl.protocol !== 'https:' || finalUrl.username || finalUrl.password
    || companyHost(finalUrl) !== companyHost(official)) fail()
  const matchedLinks = anchors(response.html).flatMap(href => {
    try {
      const url = new URL(href, finalUrl)
      return boardIdentity(url.href) === expected ? [url.href] : []
    } catch { return [] }
  })
  if (matchedLinks.length === 0) fail()
  return {
    verified: true, checkedAt: new Date().toISOString(), officialURL: finalUrl.href,
    evidenceURL: finalUrl.href, httpStatus: response.status,
    matchedLinks: [...new Set(matchedLinks)], bindingMethod: 'runtime-official-company-anchor',
  }
}
