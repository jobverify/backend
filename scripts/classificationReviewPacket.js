import { createHash } from 'node:crypto'
import { postScrapeInput } from '../src/services/postScrapeClassification.js'

const hash = value => createHash('sha256').update(value).digest('hex')

export function buildReviewPacket(jobs, { seed = 'post-scrape-review' } = {}) {
  const rows = jobs.map(job => {
    const input = postScrapeInput(job)
    const company = String(job.company || job.source).trim()
    return { id: job.trialId, trialId: job.trialId, source: job.source, company,
      title: input.title, location: job.location, url: job.sourceUrl || job.applyUrl,
      body: input.body, sourceEmploymentType: input.sourceEmploymentType,
      sourceExperienceRequired: input.sourceExperienceRequired, eligibleBatches: input.eligibleBatches,
      postedDate: input.postedDate, referenceYear: input.referenceYear,
      split: parseInt(hash(company.toLowerCase()).slice(0, 8), 16)%2 ? 'holdout' : 'development',
      order: hash(`${seed}:${job.trialId}`),
    }
  }).filter(job => job.body).sort((a,b) => a.order.localeCompare(b.order))
  const pools = [
    job => /\b(?:contract(?:or)?|fixed[- ]term|temporary|freelance)\b/i.test(`${job.title.replace(/_/g, ' ')} ${job.sourceEmploymentType}`),
    job => /\bintern(?:ship)?\b/i.test(`${job.title.replace(/_/g, ' ')} ${job.sourceEmploymentType}`),
    job => /\b(?:freshers?|graduates?|campus|no (?:prior|previous|work) experience)\b/i.test(`${job.title} ${job.body}`),
    job => /\b\d+\+?\s+years?[^\n]{0,45}\bexperience\b/i.test(job.body),
    () => true,
  ]
  const selected = [], seen = new Set(), companies = new Map()
  for (const split of ['development', 'holdout']) {
    for (const accepts of pools) {
      let count = 0
      for (const row of rows) {
        const company = row.company.toLowerCase()
        if (row.split !== split || seen.has(row.id) || (companies.get(company)||0) >= 2 || !accepts(row)) continue
        const { order: _order, ...source } = row
        selected.push(source)
        seen.add(row.id)
        companies.set(company, (companies.get(company)||0)+1)
        if (++count >= 6) break
      }
    }
  }
  return { method: 'Frozen employer-only diagnostic sample: up to six jobs per lexical stratum and random stratum in each company-separated split. At most two jobs per company. This is not a population accuracy estimate.',
    seed, jobs: selected }
}
