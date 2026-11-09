import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { readNativeDocument, activeIframeSources, activeScripts } from './activeNativeHtml.js'
import { activeLeverCareersFeeds } from './activeLeverCareersFeed.js'
import { nextCareersGreenhouseFeeds } from './nextCareersGreenhouseFeed.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'

const HTTP = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url : null } catch { return null }
}
const ATS_HOST = /(?:^|\.)(?:greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com|successfactors\.com|oraclecloud\.com|darwinbox\.in|darwinbox\.com|keka\.com|workable\.com|recruitee\.com|breezy\.hr|jobvite\.com|icims\.com)$/i
const CAREERS = /careers?|jobs?|openings?|(?:open|view|available)[-_ /]?(?:roles?|positions?)|join[-_/ ]?(?:us|the[-_ ]?team)|vacanc|opportunit|work[-_ ]?with[-_ ]?us|we[-_ ]?are[-_ ]?hiring/i
const THIRD_PARTY_HOST = /(?:^|\.)(?:linkedin\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|glassdoor\.com|indeed\.com)$/i
const decode = text => String(text || '').replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/').replace(/&amp;/gi, '&')

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)' } })
  if (Number(response.headers.get('content-length')) > 3000000) throw new Error('official_response_too_large')
  const html = await response.text()
  if (Buffer.byteLength(html, 'utf8') > 3000000) throw new Error('official_response_too_large')
  return { status: response.status, url: response.url, html }
}

export const defaultFetchJson = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Public ATS HTTP ${response.status}`)
  return response.json()
}

export const discoverOfficialAtsBoards = async (provider, { fetchPage = defaultFetchPage, signal } = {}) => {
  const suppliedRoots = [provider.companyCareerPage, provider.officialHomepageUrl, provider.officialCareersPageUrl,
    provider.companyDomain ? `https://${provider.companyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/` : null]
    .filter(value => { const url = HTTP(value); return url && !url.username && !url.password && !ATS_HOST.test(url.hostname) && !THIRD_PARTY_HOST.test(url.hostname) })
  const declaredDomain = provider.companyDomain && HTTP(/^https?:\/\//i.test(provider.companyDomain) ? provider.companyDomain : `https://${provider.companyDomain}`)
  const trustedBase = (declaredDomain && !ATS_HOST.test(declaredDomain.hostname) && !THIRD_PARTY_HOST.test(declaredDomain.hostname)
    ? declaredDomain.hostname : HTTP(suppliedRoots[0])?.hostname)?.replace(/^www\./i, '')
  const trusted = url => Boolean(url && !url.username && !url.password && trustedBase
    && (url.hostname === trustedBase || url.hostname.endsWith(`.${trustedBase}`)))
  const roots = suppliedRoots.filter(value => trusted(HTTP(value)))
  const withoutFragment = value => { const url = new URL(value); url.hash = ''; return url.href }
  const queue = [...new Set(roots.map(withoutFragment))]
  const seen = new Set()
  const boards = new Map()
  const candidateBoards = new Map()
  const checks = []
  const addBoard = (url, officialURL, evidenceURL, method, status, verified = true) => {
    const target = HTTP(url)
    if (!target || target.protocol !== 'https:' || target.username || target.password || target.port) return
    const board = identifyPublicAtsBoard(url)
    if (!board) return
    const region = board.region || (target.hostname.endsWith('.eu.greenhouse.io') ? 'eu' : 'global')
    const key = `${board.atsPlatform}:${board.boardToken}:${region}`
    ;(verified ? boards : candidateBoards).set(key, { ...board, bindingEvidence: {
      verified, checkedAt: new Date().toISOString(), officialURL, evidenceURL,
      httpStatus: status, matchedLinks: [url], bindingMethod: method,
    } })
  }
  let attempts = 0
  while (queue.length && attempts < 4) {
    signal?.throwIfAborted()
    const requestedURL = queue.shift()
    if (seen.has(requestedURL)) continue
    seen.add(requestedURL)
    attempts++
    try {
      const response = await fetchPage(requestedURL, { signal })
      const finalURL = typeof response.url === 'string' ? response.url : null
      checks.push({ requestedURL, finalURL, httpStatus: response.status, checkedAt: new Date().toISOString() })
      const pageURL = HTTP(finalURL)
      if (!pageURL) continue
      // A successful redirect from the official company site binds the ATS.
      if (response.status >= 200 && response.status < 300 && identifyPublicAtsBoard(finalURL)) {
        addBoard(finalURL, requestedURL, finalURL, 'official-redirect', response.status)
        continue
      }
      if (response.status < 200 || response.status >= 300) continue
      if (!trusted(pageURL) || ATS_HOST.test(pageURL.hostname)) continue
      seen.add(withoutFragment(pageURL.href))
      if (typeof response.html !== 'string' || Buffer.byteLength(response.html, 'utf8') > 3000000) continue
      const html = normalizeNativeAttributeBoundaries(decode(response.html))
      const documentOptions = { excludeObjectFallback: true }
      const document = readNativeDocument(html, documentOptions)
      const careersPage = CAREERS.test(pageURL.pathname + ' ' + pageURL.hostname)
        || [provider.companyCareerPage, provider.officialCareersPageUrl].includes(requestedURL)
      const resolve = value => { try { return HTTP(new URL(value, pageURL).href) } catch { return null } }
      const recruitingPages = []
      for (const anchor of document.nodes(node => node.tag === 'a' && node.attrs.href)) {
        const target = resolve(anchor.attrs.href)
        if (!target) continue
        const hiringLink = CAREERS.test(document.text(anchor) + ' ' + target.pathname)
        const publicBoard = identifyPublicAtsBoard(target.href)
        const nativePosting = careersPage && !/talent (?:community|network|pool)|general application/i.test(document.text(anchor))
          && (['jobs.ashbyhq.com', 'jobs.lever.co', 'jobs.eu.lever.co'].includes(target.hostname)
            && publicBoard && /^\/[^/]+\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/?$/i.test(target.pathname)
          || ['boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards.eu.greenhouse.io', 'job-boards.eu.greenhouse.io'].includes(target.hostname)
            && /^\/[a-z\d][a-z\d._-]{0,100}\/jobs\/\d+\/?$/i.test(target.pathname))
        if (hiringLink || nativePosting) addBoard(target.href, finalURL, finalURL,
          nativePosting ? 'official-careers-native-posting-link' : 'official-careers-link', response.status)
        if (hiringLink && trusted(target)) {
          const normalized = withoutFragment(target.href)
          if (!seen.has(normalized) && !recruitingPages.includes(normalized)) recruitingPages.push(normalized)
        }
      }
      recruitingPages.sort((a, b) => Number(Boolean(new URL(a).search)) - Number(Boolean(new URL(b).search)))
      for (const next of recruitingPages.reverse()) {
        const queued = queue.indexOf(next)
        if (queued >= 0) queue.splice(queued, 1)
        queue.unshift(next)
      }
      if (careersPage) {
        for (const feed of activeLeverCareersFeeds(document)) {
          addBoard(feed, finalURL, finalURL, 'official-careers-active-native-fetch', response.status)
        }
        for (const value of activeIframeSources(html, documentOptions)) {
          const target = resolve(value)
          if (target) addBoard(target.href, finalURL, finalURL, 'official-careers-active-iframe', response.status)
        }
        for (const script of document.nodes(node => node.tag === 'script' && node.attrs.src
          && !Object.hasOwn(node.attrs, 'nomodule')
          && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))) {
          const target = resolve(script.attrs.src)
          if (!target || target.protocol !== 'https:' || target.username || target.password || target.port || target.hash) continue
          const embeddedBoard = identifyPublicAtsBoard(target.href)
          const ashby = target.hostname === 'jobs.ashbyhq.com' && embeddedBoard?.atsPlatform === 'ashby'
            && target.pathname === `/${encodeURIComponent(embeddedBoard.boardToken)}/embed`
            && (!target.search || [...target.searchParams].length === 1 && target.searchParams.get('version') === '2')
          const greenhouse = ['boards.greenhouse.io', 'boards.eu.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io'].includes(target.hostname)
            && target.pathname === '/embed/job_board/js' && target.searchParams.getAll('for').length === 1
            && [...target.searchParams.keys()].every(key => key === 'for')
          if (ashby || greenhouse) addBoard(target.href, finalURL, finalURL, 'official-careers-active-ats-embed', response.status)
        }
        const collectCandidates = (body, evidenceURL, status) => {
          for (const value of decode(body).match(/https?:\/\/[^\s<>"'\\`]+/g) || []) {
            addBoard(value, finalURL, evidenceURL, 'unverified-script-candidate', status, false)
          }
        }
        for (const body of activeScripts(html, documentOptions)) collectCandidates(body, finalURL, response.status)
        const scripts = document.nodes(node => node.tag === 'script' && node.attrs.src
          && !Object.hasOwn(node.attrs, 'nomodule')
          && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))
          .map(node => resolve(node.attrs.src))
          .filter(url => trusted(url) && !/analytics|tracking|pixel|gtag/i.test(url.pathname))
          .sort((a, b) => Number(/career|job|greenhouse|ashby|lever/i.test(b.pathname)) - Number(/career|job|greenhouse|ashby|lever/i.test(a.pathname)))
        // Bounded source inspection, never executing third-party page code.
        if (boards.size === 0) for (const url of scripts.slice(0, 2)) {
          try {
            const script = await fetchPage(url.href, { signal })
            checks.push({ requestedURL: url.href, finalURL: script.url || null, httpStatus: script.status, checkedAt: new Date().toISOString() })
            if (script.status !== 200 || !trusted(HTTP(script.url)) || typeof script.html !== 'string'
              || Buffer.byteLength(script.html, 'utf8') > 3000000) continue
            for (const feed of nextCareersGreenhouseFeeds(document, script.url, script.html)) {
              addBoard(feed, finalURL, script.url, 'official-careers-current-next-route-native-call', script.status)
            }
            collectCandidates(script.html, script.url, script.status)
          } catch { signal?.throwIfAborted() /* Retain the page check without inventing a board. */ }
        }
      }
      if (boards.size) break
    } catch (error) {
      signal?.throwIfAborted()
      checks.push({ requestedURL, httpStatus: null, checkedAt: new Date().toISOString(), failureKind: error?.name === 'TimeoutError' ? 'timeout' : 'network_or_response_error' })
    }
  }
  return { boards: [...boards.values()], candidateBoards: [...candidateBoards].filter(([key]) => !boards.has(key)).map(([, board]) => board),
    checks, reason: boards.size ? null : roots.length ? 'no-verified-supported-ats-binding' : 'missing-official-company-surface' }
}

