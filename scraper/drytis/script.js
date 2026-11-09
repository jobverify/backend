import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'drytis'
export const COMPANY = 'DRYTIS'
export const HOMEPAGE_URL = 'https://drytis.com/'
export const ABOUT_URL = 'https://drytis.com/about'
export const PRIVACY_URL = 'https://drytis.com/privacy'
export const TERMS_URL = 'https://drytis.com/terms'
export const ENGINEERS_URL = 'https://drytis.com/engineers'
export const SITEMAP_URL = 'https://drytis.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://drytis.com/careers',
  'https://drytis.com/career',
  'https://drytis.com/jobs',
  'https://drytis.com/job',
  'https://drytis.com/join-us',
  'https://drytis.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bopen roles?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bapply for (?:this|the) (?:role|position)\b/i,
  /\bjob description\b/i,
  /\bposition summary\b/i,
  /\bjoin our team\b/i,
  /\bsubmit your application\b/i,
  /mailto:[^"' >]*(careers?|jobs?|recruit|recruiting|talent|hr)[^"' >]*/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[—–]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasCurrentShellOrganizationSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /"@type"\s*:\s*"Organization"/i.test(page)
    && /"name"\s*:\s*"Drytis"/i.test(page)
    && /"url"\s*:\s*"https:\/\/drytis\.com\/"/i.test(page)
    && normalized.includes('solutions pricing about blog')
    && /https:\/\/studio\.drytis\.ai\/login/i.test(page)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const hasOctober2026Identity = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()
  return /https:\/\/studio\.drytis\.ai\/login/i.test(page)
    && /mailto:hello@drytis\.com/i.test(page)
    && (/href=["']\/careers\/?["']/i.test(page)
      || /href=["']#top["'][^>]*aria-current=["']page["'][^>]*>\s*Careers\s*<\/a>/i.test(page))
    && text.includes('ai and engineers, building together')
    && /(?:©|&copy;)\s*2026\s+Drytis\.\s*All rights reserved\./i.test(page)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const title = normalizeWhitespace(String(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''))
  const hasLegacyHeroCopy =
    normalized.includes('ai democratized starting. drytis democratizes finishing.')
    && normalized.includes('we built the door.')
    && page.includes('2026 Drytis. All rights reserved.')
  const hasCurrentHeroCopy =
    normalized.includes("ai only gets you started. it doesn't get you finished.")
    && normalized.includes('a real human engineer steps in.')
    && normalized.includes('you build something that actually works.')
  const hasAugust2026HeroCopy =
    hasCurrentShellOrganizationSignal(page)
    && /the gap between\s+[‘’'"]?it works[‘’'"]?\s+and\s+[‘’'"]?it['’]s ready[‘’'"]?\s+is an engineer/i.test(normalized)
    && normalized.includes('ai can start a project. only a real engineer can finish one.')
    && normalized.includes('ai writes software. humans build companies.')
    && /the moment ai says it['’]s done,\s+a drytis engineer takes over/i.test(normalized)

  const hasCurrentHomepageIdentity =
    hasCurrentShellOrganizationSignal(page)
    && /<a\b[^>]*href=["']\/["'][^>]*>\s*drytis\s*<\/a>/i.test(page)
    && /<a\b[^>]*href=["']\/careers["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && normalized.includes('ai writes software. humans build companies. drytis is the human part.')
    && /(?:©|&copy;)\s*2026\s+Drytis\.\s*All rights reserved\./i.test(page)

  return (
    /^Drytis\b/i.test(title)
    && /AI builds prototypes\.\s*Humans build companies\./i.test(title)
    && (hasLegacyHeroCopy || hasCurrentHeroCopy)
  ) || hasAugust2026HeroCopy || hasCurrentHomepageIdentity
    || (hasOctober2026Identity(page)
      && /^drytis\s*[—-]\s*Built with AI\. Perfected by engineers\.$/i.test(title)
      && normalized.includes('ai creates the first version. drytis engineers refine, test and prepare it for launch.'))
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const raw = page.toLowerCase()
  const normalized = normalizeWhitespace(page).toLowerCase()
  const hasLegacyAboutCopy =
    raw.includes('drytis exists so finishing is just as accessible as starting.')
    && normalized.includes('we built drytis for that exact moment.')
    && normalized.includes("you're probably at the wrong company.")
  const hasCurrentAboutCopy =
    normalized.includes("you didn't fail. ai was not enough .")
    && normalized.includes('what no ai has ever done.')
    && normalized.includes('everyone has a prototype. almost nobody has a product.')
  const hasAugust2026AboutCopy =
    hasCurrentShellOrganizationSignal(page)
    && normalized.includes("we turned 'hire an engineer' into something you can buy by the token.")
    && normalized.includes('drytis is human intelligence')
    && normalized.includes('tokenized and accessible')
    && normalized.includes('ai writes software. drytis gives you the engineer behind it.')
    && normalized.includes('we believe the future is built by engineers. ai just made them more powerful.')
    && normalized.includes('engineers deliver outcomes.')

  return ((
    /<title>\s*Drytis\s*[\u2014-]\s*About\s*<\/title>/i.test(page)
      || /<title>\s*About\s*\|\s*Drytis\s*<\/title>/i.test(page)
  ) && (hasLegacyAboutCopy || hasCurrentAboutCopy))
    || hasAugust2026AboutCopy
    || (hasOctober2026Identity(page)
      && /<title>\s*About\s*[—-]\s*Drytis\s*<\/title>/i.test(page)
      && normalized.includes("we turned 'hire an engineer' into something you can buy by the token.")
      && normalized.includes('drytis is human intelligence, tokenized and accessible')
      && normalized.includes('engineers deliver outcomes.'))
}

export const pageHasExpectedEngineersLink = (html) =>
  /<a\b[^>]*href=["'](?:https?:\/\/drytis\.com)?\/engineers["'][^>]*>/i.test(String(html ?? ''))

export const hasOfficialPrivacySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const hasSharedPrivacyContent =
    normalized.includes('how drytis collects, uses, and protects your personal information.')
    && normalized.includes('drytis, inc.')
    && normalized.includes('job applicants and recruiting candidates')
  const hasLegacyPrivacySurface =
    /<title>\s*Privacy\s*\|\s*Drytis\s*-\s*AI App Builder\s*<\/title>/i.test(page)
    && pageHasExpectedEngineersLink(page)
  const hasCurrentPrivacySurface =
    /<title>\s*Privacy Policy\s*\|\s*Drytis\s*<\/title>/i.test(page)
    && normalized.includes('cookie policy')
    && normalized.includes('last updated: april 3, 2026')

  return hasSharedPrivacyContent
    && (hasLegacyPrivacySurface || hasCurrentPrivacySurface)
}

export const hasOfficialTermsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const hasSharedTermsContent =
    normalized.includes('the terms, policies, and agreements that govern your use of the drytis platform.')
    && normalized.includes('drytis charges on a pay-per-use basis.')
    && normalized.includes('support@drytis.com')
    && normalized.includes('state of delaware, united states')
  const hasLegacyTermsSurface =
    /<title>\s*Terms\s*\|\s*Drytis\s*-\s*AI App Builder\s*<\/title>/i.test(page)
    && pageHasExpectedEngineersLink(page)
  const hasCurrentTermsSurface =
    /<title>\s*Terms of Service\s*\|\s*Drytis\s*<\/title>/i.test(page)
    && normalized.includes('acceptable use')
    && normalized.includes('ai use policy')
    && normalized.includes('data processing')

  return hasSharedTermsContent
    && (hasLegacyTermsSurface || hasCurrentTermsSurface)
}

export const hasOfficialEngineersSignal = (html) => {
  const page = String(html ?? '')
  const raw = page.toLowerCase()
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Our Engineers\s*\|\s*Drytis\s*<\/title>/i.test(page)
    && raw.includes('meet the vetted senior engineers behind drytis lifeguard.')
    && normalized.includes('not a directory. not a marketplace.')
    && normalized.includes('1 in 12')
    && normalized.includes('applicants make it through.')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const sitemapHasUnexpectedCareerLikeUrl = (xml) => {
  const matches = Array.from(
    String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi),
    (match) => match[1],
  )

  return matches.some((entry) => /\/(?:careers?|jobs?|join-us|work-with-us)(?:\/|$|[?#])/i.test(entry))
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()
  const hasLegacy404Surface =
    normalized.includes('error response')
    && normalized.includes('error code: 404')
    && normalized.includes('message: file not found.')
    && normalized.includes('nothing matches the given uri.')
  const hasCurrentPlain404Surface =
    /^404(?:\s*[—-]\s*|\s+)page not found\.?$/i.test(normalized)

  const hasCaddy404Surface = normalized === "404 - not found 404 page not found the route you requested doesn't exist. check your caddyfile configuration."

  const isKnownHomepageShell = Number(page?.status) === 200
    && hasOfficialHomepageSignal(page?.html)

  return (isKnownHomepageShell || (
    Number(page?.status) === 404
    && (hasLegacy404Surface || hasCurrentPlain404Surface || hasCaddy404Surface)
  )) && !hasPublicJobsSignal(page?.html)
}

export const hasVerifiedUnpublishableCareersLanding = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('careers at drytis')
    && normalized.includes('5 open roles')
    && /<section\s+id=["']roles["']/i.test(page)
    && /class=["'][^"']*dr-role-card/i.test(page)
    && /href=["']#apply["']/i.test(page)
    && /<section\s+id=["']apply["']/i.test(page)
    && /mailto:careers@drytis\.ai/i.test(page)
    && normalized.includes('remote-first. real ownership.')
}

export const hasVerifiedEmptyCareersLanding = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()
  // Remove only the observed empty-state/notification phrases before checking for jobs.
  const openingCheck = page
    .replace(/No open roles\s*(?:<[^>]+>\s*)*right now/gi, '')
    .replace(/Notify me about open roles/gi, '')
    .replace(/There are no open roles at Drytis right now\./gi, '')
  return hasOctober2026Identity(page)
    && /<title>\s*Careers\s*[—-]\s*Drytis\s*<\/title>/i.test(page)
    && text.includes('careers at drytis no open roles right now')
    && text.includes("leave your email and we'll let you know as soon as a position opens.")
    && /<form\b[^>]*id=["']notifyForm["']/i.test(page)
    && !hasPublicJobsSignal(openingCheck)
}

export const createDrytisScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('DRYTIS verified homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('DRYTIS homepage now appears to expose a public jobs surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('DRYTIS verified about page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('DRYTIS about page now appears to expose a public jobs surface')
    }

    const privacy = await fetchPage(PRIVACY_URL)
    if (privacy.status === 404) {
      if (!isVerifiedMissingCareerRoute(privacy)) {
        throw new Error('DRYTIS verified privacy page no longer matches the known first-party surface')
      }
    } else if (privacy.status !== 200 || !hasOfficialPrivacySignal(privacy.html)) {
      throw new Error('DRYTIS verified privacy page no longer matches the known first-party surface')
    }
    if (privacy.status === 200 && hasPublicJobsSignal(privacy.html)) {
      throw new Error('DRYTIS privacy page now appears to expose a public jobs surface')
    }

    const terms = await fetchPage(TERMS_URL)
    if (terms.status === 404) {
      if (!isVerifiedMissingCareerRoute(terms)) {
        throw new Error('DRYTIS verified terms page no longer matches the known first-party surface')
      }
    } else if (terms.status !== 200 || !hasOfficialTermsSignal(terms.html)) {
      throw new Error('DRYTIS verified terms page no longer matches the known first-party surface')
    }
    if (terms.status === 200 && hasPublicJobsSignal(terms.html)) {
      throw new Error('DRYTIS terms page now appears to expose a public jobs surface')
    }

    const engineers = await fetchPage(ENGINEERS_URL)
    if (engineers.status === 404) {
      if (!isVerifiedMissingCareerRoute(engineers)) {
        throw new Error('DRYTIS verified engineers page no longer matches the known first-party surface')
      }
    } else if (engineers.status !== 200 || !hasOfficialEngineersSignal(engineers.html)) {
      throw new Error('DRYTIS verified engineers page no longer matches the known first-party surface')
    }
    if (engineers.status === 200 && hasPublicJobsSignal(engineers.html)) {
      throw new Error('DRYTIS engineers page now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status === 404) {
      if (!isVerifiedMissingCareerRoute(sitemap)) {
        throw new Error('DRYTIS verified sitemap no longer matches the known careers-free surface')
      }
    } else if (sitemap.status !== 200 || sitemapHasUnexpectedCareerLikeUrl(sitemap.html)) {
      throw new Error('DRYTIS verified sitemap no longer matches the known careers-free surface')
    }

    let hasUnpublishableCareersLanding = false
    let hasExplicitlyEmptyCareersLanding = false
    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (routeUrl === 'https://drytis.com/careers' && routePage.status === 200 && (hasVerifiedUnpublishableCareersLanding(routePage.html) || hasVerifiedEmptyCareersLanding(routePage.html))) {
        hasUnpublishableCareersLanding = true
        const landingUrl = new URL(routePage.url || routeUrl)
        if (landingUrl.origin !== new URL(HOMEPAGE_URL).origin || !/^\/careers\/?$/.test(landingUrl.pathname)) {
          throw new Error('DRYTIS careers landing left the verified first-party route')
        }
        hasExplicitlyEmptyCareersLanding = hasVerifiedEmptyCareersLanding(routePage.html)
        continue
      }

      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`DRYTIS verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return attachInventoryEvidence([], {
      status: hasExplicitlyEmptyCareersLanding ? 'verified-empty' : 'discovery-only',
      surface: 'https://drytis.com/careers/', firstParty: true,
      listingComplete: hasExplicitlyEmptyCareersLanding,
      pagesFetched: 6 + NO_PUBLIC_CAREERS_ROUTE_URLS.length,
      reportedTotal: hasExplicitlyEmptyCareersLanding ? 0 : null,
      indiaFacetCount: hasExplicitlyEmptyCareersLanding ? 0 : null,
      verifiedAt: new Date().toISOString(),
      reason: hasExplicitlyEmptyCareersLanding ? 'First-party careers landing explicitly states No open roles right now.'
        : hasUnpublishableCareersLanding ? 'DRYTIS careers landing is discovery-only without explicit current empty inventory.'
          : 'DRYTIS has no verified public listing inventory.',
    })
  },
})

export const run = async (options = {}) => createDrytisScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const evidence = readInventoryEvidence(jobs)
  if (isDryRun && evidence) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(evidence, null, 2))
  }
  if (evidence?.listingComplete === false) {
    console.error(evidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
