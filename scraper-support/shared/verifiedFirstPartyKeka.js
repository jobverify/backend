import { normalizeCity } from '../utils/cityNormalizer.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const POSITIVE_ID = /^[1-9][0-9]*$/
const RESERVED_REGION_CODES = new Set(['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'])
const clean = (value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const htmlDecode = (value) => String(value || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
const visibleText = (value) => clean(htmlDecode(htmlDecode(value))
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<[^>]*>/g, ' '))
const required = (value, field) => {
  const normalized = clean(value)
  if (!normalized) throw new Error(`Invalid Keka record: missing ${field}`)
  return normalized
}
const strictUrl = (value) => {
  let url
  try { url = new URL(value) } catch { throw new Error('Invalid Keka URL identity') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('Invalid Keka URL identity')
  }
  return url
}
const comparableUrl = (value) => {
  const url = strictUrl(value)
  url.pathname = url.pathname.replace(/\/$/, '') || '/'
  return url.href
}
const sameUrl = (left, right) => comparableUrl(left) === comparableUrl(right)
const withoutComments = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '')
const withoutScriptBodies = (html) => withoutComments(html).replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
const scriptBodies = (html) => [...withoutComments(html).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1])
const attributes = (html, tags, attribute) => [...withoutScriptBodies(html).matchAll(new RegExp('<(?:' + tags + ')\\b[^>]*>', 'gi'))]
  .map((match) => match[0].match(new RegExp('\\b' + attribute + '\\s*=\\s*(["\'])(.*?)\\1', 'i'))?.[2])
  .filter(Boolean)
  .map(htmlDecode)

const displayNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const countryNameAliases = new Map([
  ['US', new Set(['usa', 'united states of america'])],
  ['GB', new Set(['uk'])],
])

const parseKhConfig = (html, portalName) => {
  const blocks = scriptBodies(html).flatMap((body) => [...body.matchAll(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/gi)].map((match) => match[1]))
  const block = blocks.length === 1 ? blocks[0] : ''
  const read = (key) => clean(block.match(new RegExp(`\\b${key}\\s*:\\s*['"]([^'"]+)`, 'i'))?.[1])
  return {
    identifier: read('identifier'),
    domain: read('domain'),
    portalName: read('portalName') || portalName,
  }
}

const verifyLinkHandoff = (html, config) => {
  const links = attributes(html, 'a', 'href')
  if (!links.some((link) => {
    try { return sameUrl(new URL(link, config.officialUrl).href, config.handoffUrl) } catch { return false }
  })) throw new Error(`Official careers handoff changed for ${config.source}`)
}

const extractPortalDocumentUrl = (html, config) => {
  const values = scriptBodies(html).flatMap((body) => [...body.matchAll(/fetch\(\s*['"]([^'"]+careerportal\/[^'"]+\.html)['"]/gi)].map((match) => match[1]))
  const value = values.length === 1 ? values[0] : null
  if (!value) throw new Error(`Keka career portal document is missing for ${config.source}`)
  const url = strictUrl(new URL(value, config.portalShellUrl).href)
  const expected = new URL(config.kekaRootUrl)
  const pattern = new RegExp(`^/ats/documents/${config.identifier}/careerportal/[a-z0-9]+\\.html$`, 'i')
  if (url.origin !== expected.origin || url.search || !pattern.test(url.pathname)) {
    throw new Error(`Invalid Keka career portal document identity for ${config.source}`)
  }
  return url.href
}

const verifyPortalConfig = (html, config) => {
  const khConfig = parseKhConfig(html, config.portalName)
  if (khConfig.identifier !== config.identifier
    || !sameUrl(khConfig.domain, config.kekaRootUrl)
    || khConfig.portalName !== config.portalName) {
    throw new Error(`Invalid Keka configuration identity for ${config.source}`)
  }
  const scripts = attributes(html, 'script', 'src').map((src) => {
    try { return new URL(src, config.kekaRootUrl).href } catch { return null }
  }).filter(Boolean)
  if (!scripts.some((url) => sameUrl(url, config.embedScriptUrl))) {
    throw new Error(`Invalid Keka embedded renderer identity for ${config.source}`)
  }
}

const verifyRendererContract = (script, config) => {
  const body = String(script)
  const signals = [
    'api/organization/${portalName}/careerportalinfo',
    'api/embedjobs/${portalName}/active/',
    'jobdetails/',
    'job.jobLocations',
  ]
  if (!signals.every((signal) => body.includes(signal)) || !body.includes('khConfig.identifier')) {
    throw new Error(`Keka embedded renderer contract changed for ${config.source}`)
  }
}

const validatePortalIdentity = (payload, config) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || clean(payload.name) !== config.portalIdentity.name
    || clean(payload.shortName) !== config.portalIdentity.shortName
    || clean(payload.careersPortalDomain).toLowerCase() !== config.portalIdentity.domain) {
    throw new Error(`Keka portal identity changed for ${config.source}`)
  }
}

const validateLocation = (location, jobId, index) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new Error(`Invalid Keka geography for ${jobId}: location ${index + 1}`)
  }
  const id = String(location.id ?? '')
  if (!POSITIVE_ID.test(id) || Number(id) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid Keka geography for ${jobId}: location identity`)
  }
  const name = clean(location.name)
  const city = clean(location.city)
  if (!name && !city) throw new Error(`Invalid Keka geography for ${jobId}: missing location`)
  if (location.state != null && typeof location.state !== 'string') {
    throw new Error(`Invalid Keka geography for ${jobId}: state`)
  }
  const state = clean(location.state)
  const countryCode = required(location.countryCode, `country code for ${jobId}`).toUpperCase()
  const countryName = required(location.countryName, `country name for ${jobId}`)
  if (!/^[A-Z]{2}$/.test(countryCode) || RESERVED_REGION_CODES.has(countryCode)) {
    throw new Error(`Invalid Keka geography for ${jobId}: conflicting country`)
  }
  const canonicalCountryName = displayNames.of(countryCode)
  const acceptedCountryNames = countryNameAliases.get(countryCode) || new Set()
  if (!canonicalCountryName || canonicalCountryName === countryCode || canonicalCountryName === 'Unknown Region'
    || (clean(canonicalCountryName).toLowerCase() !== countryName.toLowerCase()
      && !acceptedCountryNames.has(countryName.toLowerCase()))) {
    throw new Error(`Invalid Keka geography for ${jobId}: conflicting country`)
  }
  return { id, name: name || city, city: city || name, state: state || null, countryCode, countryName }
}

const validateDescriptionRuleLocation = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)
    || !clean(location.name) || !clean(location.city)
    || location.countryCode !== 'IN' || location.countryName !== 'India'
    || (location.state != null && typeof location.state !== 'string')) return false
  return true
}

const validateConfig = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid verified Keka configuration')
  const config = { ...input }
  if (!clean(config.source) || !clean(config.companyName) || !UUID.test(config.identifier)
    || !/^[a-z0-9-]+$/i.test(config.portalName)
    || !['portal-link', 'embedded-script'].includes(config.handoffType)) {
    throw new Error('Invalid verified Keka configuration')
  }
  const officialUrl = strictUrl(config.officialUrl)
  const handoffUrl = strictUrl(config.handoffUrl)
  const kekaRootUrl = strictUrl(config.kekaRootUrl)
  if (!kekaRootUrl.hostname.endsWith('.keka.com') || kekaRootUrl.pathname !== '/careers/'
    || kekaRootUrl.search || handoffUrl.origin !== kekaRootUrl.origin) {
    throw new Error('Invalid verified Keka configuration')
  }
  const portalIdentity = config.portalIdentity
  if (!portalIdentity || clean(portalIdentity.name) !== portalIdentity.name
    || clean(portalIdentity.shortName) !== portalIdentity.shortName
    || clean(portalIdentity.domain).toLowerCase() !== kekaRootUrl.hostname) {
    throw new Error('Invalid verified Keka configuration')
  }
  if (config.handoffType === 'portal-link') {
    const shell = strictUrl(config.portalShellUrl)
    if (shell.origin !== kekaRootUrl.origin || !/^\/careers\/?$/.test(shell.pathname)) {
      throw new Error('Invalid verified Keka configuration')
    }
  } else if (config.portalShellUrl !== undefined
    || !sameUrl(handoffUrl, `${config.kekaRootUrl}api/embedjobs/js/${config.identifier}`)) {
    throw new Error('Invalid verified Keka configuration')
  }
  const descriptionLocationRules = config.descriptionLocationRules || []
  if (!Array.isArray(descriptionLocationRules)
    || descriptionLocationRules.some((rule) => !rule || !POSITIVE_ID.test(rule.id)
      || !clean(rule.title) || !Array.isArray(rule.descriptionIncludes) || !rule.descriptionIncludes.length
      || rule.descriptionIncludes.some((signal) => !clean(signal))
      || !validateDescriptionRuleLocation(rule.location))
    || new Set(descriptionLocationRules.map((rule) => rule.id)).size !== descriptionLocationRules.length) {
    throw new Error('Invalid verified Keka configuration')
  }
  const timeoutMs = config.requestTimeoutMs ?? 15000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid verified Keka configuration')
  return {
    ...config,
    officialUrl: officialUrl.href,
    handoffUrl: handoffUrl.href,
    kekaRootUrl: kekaRootUrl.href,
    portalInfoUrl: `${kekaRootUrl.href}api/organization/${config.portalName}/careerportalinfo`,
    activeJobsUrl: `${kekaRootUrl.href}api/embedjobs/${config.portalName}/active/${config.identifier}`,
    embedScriptUrl: `${kekaRootUrl.href}api/embedjobs/js/${config.identifier}`,
    descriptionLocationRules,
    timeoutMs,
  }
}

const validateInventory = (payload, config) => {
  if (!Array.isArray(payload)) throw new Error(`Invalid Keka active inventory for ${config.source}: expected array`)
  const seen = new Set()
  const rules = new Map(config.descriptionLocationRules.map((rule) => [rule.id, rule]))
  return payload.map((job) => {
    const id = String(job?.id ?? '')
    if (!POSITIVE_ID.test(id) || Number(id) > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Invalid Keka job identity for ${config.source}`)
    }
    if (seen.has(id)) throw new Error(`Duplicate Keka job identity ${id}`)
    seen.add(id)
    const title = required(job?.title, `title for ${id}`)
    const description = visibleText(required(job?.description, `description for ${id}`))
    if (!description) throw new Error(`Invalid Keka record: empty description for ${id}`)
    if (!Array.isArray(job?.jobLocations)) throw new Error(`Invalid Keka geography for ${id}: locations must be an array`)
    let locations = job.jobLocations.map((location, index) => validateLocation(location, id, index))
    if (new Set(locations.map((location) => location.id)).size !== locations.length) {
      throw new Error(`Invalid Keka geography for ${id}: duplicate location identity`)
    }
    if (!locations.length) {
      const rule = rules.get(id)
      if (!rule || title !== clean(rule.title)
        || !rule.descriptionIncludes.every((signal) => description.includes(clean(signal)))) {
        throw new Error(`Invalid Keka description location fallback for ${id}`)
      }
      locations = [{ id: `description:${id}`, ...rule.location }]
    }
    if (job.skillNames != null && (!Array.isArray(job.skillNames)
      || job.skillNames.some((skill) => typeof skill !== 'string' || !clean(skill)))) {
      throw new Error(`Invalid Keka skills for ${id}`)
    }
    if (job.departmentName != null && typeof job.departmentName !== 'string') {
      throw new Error(`Invalid Keka department for ${id}`)
    }
    const sourceUrl = `${config.kekaRootUrl}jobdetails/${id}`
    const applyUrl = sourceUrl
    const india = locations.filter((location) => location.countryCode === 'IN')
    if (!india.length) return null
    const primary = india[0]
    const city = /^remote$/i.test(primary.city) ? 'Remote' : normalizeCity(primary.city) || primary.city
    const location = [primary.name, primary.state, 'India'].filter(Boolean).join(', ')
    const publishedAt = clean(job.publishedOn)
    if (publishedAt && Number.isNaN(new Date(publishedAt).getTime())) {
      throw new Error(`Invalid Keka posting date for ${id}`)
    }
    return {
      source: config.source,
      company: config.companyName,
      companyCareerPage: config.officialUrl,
      companyDomain: new URL(config.officialUrl).hostname.replace(/^www\./, ''),
      atsPlatform: 'keka',
      jobId: id,
      requisitionId: clean(job.jobNumber) || id,
      title,
      location,
      locations: india.map((item) => [item.name, item.state, 'India'].filter(Boolean).join(', ')),
      city,
      state: primary.state,
      country: 'India',
      sourceUrl,
      applyUrl,
      link: applyUrl,
      jobDescription: description,
      experienceRequired: clean(job.experience) || null,
      department: clean(job.departmentName) || null,
      employmentType: Number(job.jobType) === 2 ? 'Full Time' : null,
      requiredSkills: (job.skillNames || []).map(clean),
      postingDate: publishedAt ? new Date(publishedAt).toISOString() : null,
      closingDate: null,
      publicExperienceChecked: true,
      sourceListingComplete: true,
      scrapedAt: new Date().toISOString(),
    }
  }).filter(Boolean)
}

export const createVerifiedFirstPartyKekaScraper = (input) => {
  const config = validateConfig(input)
  return {
    async run({ signal, fetchImpl = fetch } = {}) {
      const request = async (url, json = false) => {
        signal?.throwIfAborted()
        const requestSignal = signal
          ? AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)])
          : AbortSignal.timeout(config.timeoutMs)
        try {
          const response = await fetchImpl(url, {
            signal: requestSignal,
            headers: { 'User-Agent': 'JobverifyScraper/1.0', Accept: json ? 'application/json' : 'text/html,application/javascript' },
          })
          signal?.throwIfAborted()
          requestSignal.throwIfAborted()
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
          if (response.url && !sameUrl(response.url, url)) throw new Error(`Invalid Keka redirect identity for ${url}`)
          const body = json ? await response.json() : await response.text()
          signal?.throwIfAborted()
          requestSignal.throwIfAborted()
          return body
        } catch (error) {
          signal?.throwIfAborted()
          requestSignal.throwIfAborted()
          throw error
        }
      }

      const officialHtml = await request(config.officialUrl)
      let portalHtml
      if (config.handoffType === 'portal-link') {
        verifyLinkHandoff(officialHtml, config)
        const shellHtml = await request(config.portalShellUrl)
        portalHtml = await request(extractPortalDocumentUrl(shellHtml, config))
      } else {
        portalHtml = officialHtml
      }
      verifyPortalConfig(portalHtml, config)
      verifyRendererContract(await request(config.embedScriptUrl), config)
      validatePortalIdentity(await request(config.portalInfoUrl, true), config)
      const jobs = validateInventory(await request(config.activeJobsUrl, true), config)
      signal?.throwIfAborted()
      return jobs
    },
  }
}
