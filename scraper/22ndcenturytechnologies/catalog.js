import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TWENTY_SECOND_CENTURY_TECHNOLOGIES_CATALOG = {
  source: '22ndcenturytechnologies',
  companyName: '22nd Century Technologies',
  officialBrandName: '22nd Century Technologies',
  adapter: 'script',
  companyCareerPage: 'https://www.tscti.com/career/state_il',
  companyDomain: 'tscti.com',
  atsPlatform: "jobdiva-published-rss-and-staffing-intake",
  countryFilter: "India",
  paginationStrategy: "company-declared-portal+bounded-rss-keyword-feed+scope-unverified",
  extractionStrategy: "first-party-contract-intake-observations+current-openings-handoff+jobdiva-static-script-rss+india-keyword+first-failure-stop",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: "2026-11-07",
  verifiedSurfaceSummary:
    "Observed on November 7, 2026: the first-party State of Illinois contract exposes70 region/category email intake entries, not verified individual vacancies. Its Current Openings link delegates to a branded JobDiva portal and a publisher-declared RSS feed. The India keyword feed returned0 items without an authoritative country facet; its exact search link returned302 and no redirect was followed. Company/India totals and active vacancy proof remain unknown.",
  modulePath: path.join(currentDir, 'script.js'),
}

export default TWENTY_SECOND_CENTURY_TECHNOLOGIES_CATALOG
