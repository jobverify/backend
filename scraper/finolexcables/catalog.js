import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FINOLEX_CABLES_CATALOG = {
  source: 'finolexcables',
  companyName: 'Finolex Cables',
  adapter: 'script',
  homepageUrl: 'https://www.finolex.com/',
  homepageCareersLinkUrl: 'https://www.finolex.com/View/Page/Career',
  companyCareerPage: 'https://www.finolex.com/Team/Career',
  checkedLoginCareersRouteUrl: 'https://www.finolex.com/careers',
  companyDomain: 'finolex.com',
  atsPlatform: 'official-company-html-table',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-table-page',
  extractionStrategy:
    'verified-finolex-homepage-careers-link+verified-first-party-careers-table-row+verified-inline-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that the live Finolex Cables homepage at https://www.finolex.com/ links Careers to the first-party route https://www.finolex.com/View/Page/Career, which resolves to the public careers page at https://www.finolex.com/Team/Career. Verified that the public careers page exposes the visible opening "Polymer Compounding Engineer (Production)" with Function "Production", Education "BE Or Diploma", Experience "3 to 5 years", Location "Pune (urse)", a same-page Apply Now application form, and the HR fallback note "Drop your CV at hr@finolex.com". Also verified that https://www.finolex.com/careers currently resolves to a CMS admin login route instead of the public jobs surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FINOLEX_CABLES_CATALOG
