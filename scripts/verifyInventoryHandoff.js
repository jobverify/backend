import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const isAts = host => !['darwinbox.com', 'www.darwinbox.com'].includes(host)
  && /(?:^|\.)(?:darwinbox\.(?:in|com)|greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com)$/.test(host)
const urlFor = value => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url : null } catch { return null } }
const fetchPublicPage = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } })
  return { url: response.url, status: response.status, html: await response.text() }
}

export async function verifyInventoryHandoff(provider, inventoryEvidence, { fetchPage = fetchPublicPage } = {}) {
  const target = urlFor(inventoryEvidence?.surface)
  if (!target || !isFreshCompleteInventoryEvidence(inventoryEvidence)) return { verified: false, reason: 'fresh-complete-inventory-required' }
  const roots = [...new Set([provider.companyCareerPage, provider.homepageUrl, provider.officialHomepageUrl,
    provider.companyDomain ? `https://${provider.companyDomain}/` : null].map(value => urlFor(value)?.href).filter(Boolean))]
    .filter(value => !isAts(new URL(value).hostname))
  const checks = []
  for (const root of roots) {
    try {
      const response = await fetchPage(root)
      const final = urlFor(response.url || root)
      checks.push({ requestedURL: root, finalURL: final?.href || null, httpStatus: response.status })
      // Redirects to another employer require a separate identity review.
      if (response.status !== 200 || !final || final.hostname.replace(/^www\./, '') !== new URL(root).hostname.replace(/^www\./, '')) continue
      const html = String(response.html || '').replaceAll('\\/', '/').replaceAll('&amp;', '&')
      const matchesTarget = value => { const url = urlFor(value); return url?.hostname === target.hostname && /\/ms\/candidate/i.test(url.pathname) }
      const linked = []
      for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        if (matchesTarget(anchor[1]) && (/career|job|role|opening|opportunit/i.test(final.pathname + anchor[2].replace(/<[^>]*>/g, ' ')))) linked.push(anchor[1])
      }
      if (/career|jobs|join-us|work-with-us|explore-roles/i.test(final.pathname)) {
        for (const value of html.match(/https?:\/\/[^\s<>"'\\`]+/g) || []) if (matchesTarget(value)) linked.push(value)
      }
      if (linked.length) return { verified: true, checkedAt: new Date().toISOString(), officialURL: final.href,
        httpStatus: response.status, matchedLinks: [...new Set(linked)], inventorySurface: target.href,
        bindingMethod: 'official-company-page-links-to-exact-inventory-tenant', checks }
    } catch { checks.push({ requestedURL: root, httpStatus: null, failureKind: 'network_or_response_error' }) }
  }
  return { verified: false, checkedAt: new Date().toISOString(), reason: roots.length ? 'no-current-official-handoff-confirmed' : 'missing-official-company-surface', checks }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
  const directory = path.resolve(option('--audits'))
  const runtime = JSON.parse(fs.readFileSync(path.resolve(option('--runtime')), 'utf8'))
  if (!runtime.databaseAvailable || !Array.isArray(runtime.inventory)) throw new Error('Current runtime inventory required')
  const candidates = JSON.parse(fs.readFileSync(path.join(directory, 'outcomes.json'), 'utf8'))
    .filter(row => row.outcome === 'complete-positive-extraction' && !(runtime.inventory.find(item => item.source === row.source)?.visibleJobs > 0))
  const catalog = getScraperCatalog()
  const results = []
  let index = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < candidates.length) {
      const row = candidates[index++]
      results.push({ source: row.source, eligibleJobs: row.eligibleJobs,
        bindingEvidence: await verifyInventoryHandoff(catalog.find(provider => provider.source === row.source), row.inventoryEvidence) })
    }
  }))
  results.sort((a, b) => b.eligibleJobs - a.eligibleJobs || a.source.localeCompare(b.source))
  const destination = path.resolve(option('--output'))
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify({ candidates: results.length, verifiedHandoffs: results.filter(row => row.bindingEvidence.verified).length }))
}
