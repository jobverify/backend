const normalizeText = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const flattenJsonLd = (value) => {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd)
  if (value && typeof value === 'object' && Array.isArray(value['@graph'])) {
    return flattenJsonLd(value['@graph'])
  }

  return value && typeof value === 'object' ? [value] : []
}

const isJobPosting = (value = {}) => {
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
  return types.some((type) => String(type).toLowerCase() === 'jobposting')
}

const readLocation = (posting = {}) => {
  const location = Array.isArray(posting.jobLocation)
    ? posting.jobLocation[0]
    : posting.jobLocation
  const address = location?.address || {}
  const country = normalizeText(address.addressCountry)
  const parts = [
    normalizeText(address.addressLocality),
    normalizeText(address.addressRegion),
    country,
  ].filter(Boolean)

  return {
    city: normalizeText(address.addressLocality),
    country,
    location: parts.join(', ') || null,
  }
}

const isIndiaPosting = (posting) => {
  const { country, location } = readLocation(posting)
  return /^(india|in)$/i.test(country || '') || /\bindia\b/i.test(location || '')
}

const toSameOriginUrl = (value, careersUrl) => {
  if (!value) return null

  try {
    const url = new URL(value, careersUrl)
    return url.origin === new URL(careersUrl).origin ? url.toString() : null
  } catch {
    return null
  }
}

export const extractJsonLdJobPostings = (html = '') => {
  const postings = []
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    try {
      postings.push(...flattenJsonLd(JSON.parse(block[1])).filter(isJobPosting))
    } catch {
      // Ignore unrelated or malformed structured-data blocks.
    }
  }

  return postings
}

export const createVerifiedCareersSurfaceScraper = ({
  company,
  careersUrl,
  source,
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)

    return extractJsonLdJobPostings(html)
      .filter(isIndiaPosting)
      .map((posting) => {
        const sourceUrl = toSameOriginUrl(posting.url, careersUrl)
        const location = readLocation(posting)
        const title = normalizeText(posting.title)

        if (!title || !sourceUrl) return null

        return {
          title,
          company,
          location: location.location,
          city: location.city,
          country: 'India',
          link: sourceUrl,
          sourceUrl,
          applyUrl: sourceUrl,
          source,
          jobId: normalizeText(posting.identifier?.value || posting.identifier),
          requisitionId: normalizeText(posting.identifier?.value || posting.identifier),
          department: normalizeText(posting.occupationalCategory),
          employmentType: normalizeText(posting.employmentType),
          postingDate: normalizeText(posting.datePosted),
          closingDate: normalizeText(posting.validThrough),
          jobDescription: normalizeText(posting.description),
          requiredSkills: [],
          remoteStatus: 'On-site',
          scrapedAt: new Date().toISOString(),
        }
      })
      .filter(Boolean)
  },
})

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}
