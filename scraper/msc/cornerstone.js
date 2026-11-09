export const MSC_CORNERSTONE_URL = 'https://msc.csod.com/ux/ats/careersite/4/home'
const API_URL = 'https://uk.api.csod.com/rec-job-search/external/jobs'
const clean = value => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

export const hasMscCornerstoneHandoff = html => /<title[^>]*>\s*Work With Us - Careers &amp; Vacancies \| MSC\s*<\/title>/i.test(html)
  && /<a\b[^>]*href=["']https:\/\/msc\.csod\.com\/ux\/ats\/careersite\/4\/home["']/i.test(html)

const parseBritishDate = value => {
  if (!value || value === '-') return null
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) throw new Error('MSC CSOD date format changed')
  const iso = `${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`
  if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString() !== iso) throw new Error('MSC CSOD date is invalid')
  return iso
}

export const runMscCornerstone = async ({ fetchText, fetchJson, signal = null, now = () => new Date().toISOString() }) => {
  signal?.throwIfAborted()
  const html = await fetchText(MSC_CORNERSTONE_URL, { signal })
  let context
  try { context = JSON.parse(String(html).match(/csod\.context=(\{[\s\S]*?\});/)?.[1]) } catch {}
  if (context?.corp !== 'msc' || context?.cultureID !== 2 || context?.cultureName !== 'en-GB'
    || context?.endpoints?.cloud !== 'https://uk.api.csod.com/' || typeof context?.token !== 'string' || !context.token) {
    throw new Error('MSC CSOD public context is missing or belongs to an unexpected tenant')
  }
  const jobs = []
  const seen = new Set()
  let total = null
  for (let pageNumber = 1; pageNumber <= 100; pageNumber += 1) {
    signal?.throwIfAborted()
    const payload = await fetchJson(API_URL, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${context.token}` },
      body: JSON.stringify({
        careerSiteId: 4, careerSitePageId: 4, pageNumber, pageSize: 100,
        cultureId: 2, cultureName: 'en-GB', searchText: '', states: [], countryCodes: ['IN'], cities: [],
        placeID: '', radius: 0, postingsWithinDays: null,
        customFieldCheckboxKeys: [], customFieldDropdowns: [], customFieldRadios: [],
      }),
    })
    const data = payload?.data
    if (payload?.status !== 'Success' || !Array.isArray(data?.requisitions)
      || !Number.isInteger(data.totalCount) || data.totalCount < 0
      || (total !== null && total !== data.totalCount)) throw new Error('MSC CSOD search payload is invalid or incomplete')
    total = data.totalCount
    for (const record of data.requisitions) {
      const id = String(record?.requisitionId ?? '')
      const title = clean(record?.displayJobTitle)
      if (!/^\d+$/.test(id) || !title || !Array.isArray(record.locations) || record.locations.length === 0
        || record.locations.some(location => !clean(location?.country))) throw new Error('MSC CSOD job record is malformed')
      if (seen.has(id)) throw new Error('MSC CSOD pagination returned a duplicate job')
      seen.add(id)
      const indiaLocations = record.locations.filter(location => /^(?:IN|India)$/i.test(clean(location.country)))
      if (!indiaLocations.length) continue
      const cities = [...new Set(indiaLocations.map(location => clean(location.city)).filter(Boolean))]
      const url = `${MSC_CORNERSTONE_URL}/requisition/${id}?c=msc`
      jobs.push({
        title, company: 'MSC', source: 'msc', jobId: id, requisitionId: id,
        location: [...cities, 'India'].join(', '), city: cities[0] || null, country: 'India',
        link: url, applyUrl: url, sourceUrl: url,
        jobDescription: clean(record.externalDescription) || null,
        postingDate: parseBritishDate(record.postingEffectiveDate), closingDate: parseBritishDate(record.postingExpirationDate),
        atsPlatform: 'cornerstone-csod', scrapedAt: now(),
      })
    }
    if (seen.size === total) return jobs
    if (seen.size > total || data.requisitions.length === 0) throw new Error('MSC CSOD pagination is incomplete')
  }
  throw new Error('MSC CSOD pagination exceeded its safe bound')
}
