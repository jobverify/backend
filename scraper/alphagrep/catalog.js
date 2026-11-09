import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALPHAGREP_CATALOG = {
  source: 'alphagrep',
  companyName: 'AlphaGrep',
  adapter: 'script',
  companyCareerPage: 'https://www.alpha-grep.com/career/',
  companyDomain: 'alpha-grep.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-detail-pages',
  extractionStrategy:
    'verified-homepage-handoff+first-party-career-list+india-detail-pages+inline-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://www.alpha-grep.com/',
  careerOpportunityBaseUrl: 'https://www.alpha-grep.com/career-opportunity',
  verifiedIndiaJobUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=6902979002',
  verifiedCareers404Urls: [
    'https://www.alpha-grep.com/careers/',
    'https://www.alpha-grep.com/jobs/',
  ],
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.alpha-grep.com/ links to the first-party careers list at https://www.alpha-grep.com/career/, which currently lists five India jobs. The live Devops Engineer detail at https://www.alpha-grep.com/career-opportunity/?jid=6902979002 has a client-rendered Loading heading in initial HTML, but retains the job-specific AlphaGrep description and inline application form. The careers list supplies each job title and India location.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ALPHAGREP_CATALOG
