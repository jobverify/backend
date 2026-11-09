export const HITACHI_JOBS_URL = 'https://careers.hitachi.com/jobs'

const buildPageUrl = ({ brand, country, page }) => {
  const params = new URLSearchParams({
    'filter[brand][0]': brand,
    'filter[country][0]': country,
    page_number: String(page),
  })
  return HITACHI_JOBS_URL + '?' + params.toString()
}

const parsePage = (html, { brand, country, page }) => {
  const match = String(html ?? '').match(/window\.__PRELOAD_STATE__\s*=\s*([\s\S]*?);\s*window\.__BUILD__/)
  if (!match) throw new Error('Hitachi current first-party jobs preload is missing')
  const search = JSON.parse(match[1])?.jobSearch
  if (!Array.isArray(search?.jobs)
    || !Number.isSafeInteger(search?.totalJob)
    || search.totalJob < 0
    || search?.params?.filter?.brand?.[0] !== brand
    || search?.params?.filter?.country?.[0] !== country
    || Number(search?.params?.page_number) !== page) {
    throw new Error('Hitachi current first-party jobs filter contract changed')
  }
  return search
}

export const fetchHitachiParadoxJobs = async ({
  brand,
  country = 'India',
  legalName,
  pageSize = 10,
  fetchText,
}) => {
  if (!brand || !legalName || typeof fetchText !== 'function') {
    throw new Error('Hitachi jobs feed requires a brand, legal entity, and fetcher')
  }

  const jobs = []
  let total = null
  for (let page = 1; page <= 50; page += 1) {
    const search = parsePage(await fetchText(buildPageUrl({ brand, country, page })), { brand, country, page })
    if (total === null) total = search.totalJob
    if (total !== search.totalJob || total > pageSize * 50 || jobs.length + search.jobs.length > total) {
      throw new Error('Hitachi current first-party jobs count changed during pagination')
    }
    jobs.push(...search.jobs)
    if (jobs.length === total) break
    if (search.jobs.length !== pageSize) {
      throw new Error('Hitachi current first-party jobs listing is incomplete')
    }
  }

  if (jobs.length !== total || jobs.length !== new Set(jobs.map((job) => job?.requisitionID)).size) {
    throw new Error('Hitachi current first-party jobs listing is incomplete or duplicated')
  }

  return jobs.filter((job) => job.customFields?.some((field) => field.cfKey === 'cf_legal_name'
      && field.value === legalName)
    && job.locations?.some((location) => location.country === country))
}

export const normalizeHitachiParadoxJob = (job, { company, source, now = () => new Date().toISOString() }) => {
  const location = job?.locations?.find((item) => item.country === 'India')
  const sourceUrl = new URL(job?.originalURL || '', 'https://careers.hitachi.com/').toString()
  const applyUrl = job?.applyURL
  if (!job?.title || !job?.requisitionID || !location?.locationText
    || !/^https:\/\/careers\.hitachi\.com\/[^?#]+\/job\/R\d+$/i.test(sourceUrl)
    || !/^https:\/\/hitachi\.wd1\.myworkdayjobs\.com\/hitachi\/job\/[^?#]+\/apply$/i.test(applyUrl || '')) {
    throw new Error('Hitachi current first-party job details or application URL changed')
  }
  return {
    company,
    title: job.title,
    location: location.locationText,
    city: location.city || null,
    state: location.state || null,
    country: 'India',
    link: applyUrl,
    applyUrl,
    sourceUrl,
    source,
    jobId: job.requisitionID,
    requisitionId: job.requisitionID,
    department: null,
    employmentType: job.employmentType?.[0] || null,
    experienceRequired: job.customFields?.find((field) => field.cfKey === 'cf_experience')?.value || null,
    jobDescription: null,
    postingDate: null,
    remoteStatus: job.isRemote ? 'Remote' : 'On-site',
    scrapedAt: now(),
  }
}
