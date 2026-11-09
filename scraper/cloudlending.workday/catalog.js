import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

export const CLOUD_LENDING_CATALOG = {
  source: 'cloudlending',
  companyName: 'Cloud Lending',
  adapter: 'script',
  companyCareerPage: 'https://www.q2.com/company/why-work-at-q2/careers',
  companyDomain: 'q2.com',
  legacyCompanyDomain: 'cloudlendinginc.com',
  officialWorkdayPage: 'https://q2ebanking.wd5.myworkdayjobs.com/Q2',
  jobsApiUrl: 'https://q2ebanking.wd5.myworkdayjobs.com/wday/cxs/q2ebanking/Q2/jobs',
  detailUrlBase: 'https://q2ebanking.wd5.myworkdayjobs.com/Q2',
  locationCountry: null,
  searchText: 'India',
  countryFilter: 'India',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'The legacy Cloud Lending domain now hands off to Q2, and Q2’s official careers page links to a public Workday board for India roles.',
  legacyRedirectChain: [
    'https://cloudlendinginc.com/',
    'https://www.q2.com/fintech/lending',
    'https://www.q2.com/products/digital-banking/altfi-lending',
    'https://www.q2.com/',
  ],
  modulePath: path.join(scraperDir, 'script.js'),
}

export default CLOUD_LENDING_CATALOG
