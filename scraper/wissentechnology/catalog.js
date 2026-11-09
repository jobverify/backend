import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WISSEN_TECHNOLOGY_CATALOG = {
  source: 'wissentechnology',
  companyName: 'Wissen Technology',
  officialBrandName: 'Wissen',
  adapter: 'script',
  homepageUrl: 'https://www.wissen.com/',
  companyCareerPage: 'https://www.wissen.com/career/opportunities-wissen-technology',
  contactPageUrl: 'https://www.wissen.com/contact/writetous',
  companyDomain: 'wissen.com',
  atsPlatform: 'first-party-webflow-openings-page-with-contact-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-webflow-openings-page',
  extractionStrategy:
    'verified-webflow-openings-page+cms-job-items+detail-route-deduping+write-to-us-contact-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that https://www.wissen.com/career/opportunities-wissen-technology is the official Wissen Technology openings page, that it now renders public jobs as Webflow CMS cards linking to first-party /job/ detail routes such as Senior Level Java Technical Lead, Data Engineer, and Data Architect, and that its Send resume now handoff still resolves to https://www.wissen.com/contact/writetous. This provider extracts visible openings directly from the first-party page and dedupes the repeated CMS markup.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'wissentechnology/jobs.json',
}

export default WISSEN_TECHNOLOGY_CATALOG
