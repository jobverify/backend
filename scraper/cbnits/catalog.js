import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CBNITS_CATALOG = {
  source: 'cbnits',
  companyName: 'CBNITS',
  officialBrandName: 'CBNITS',
  adapter: 'script',
  homepageUrl: 'https://www.cbnits.com/',
  companyCareerPage: 'https://www.cbnits.com/career/',
  atsPlatform: 'first-party-nextjs-careers-discovery-only',
  countryFilter: 'India',
  paginationStrategy: 'first-party-nextjs-careers-route-and-bundle-validation',
  extractionStrategy: 'verified-first-party-nextjs-careers-route+unpublished-job-api-view-discovery-only',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cbnits.com',
  verifiedOn: '2026-10-09',
  verificationDisposition: 'verified-first-party-careers-discovery-only-no-published-inventory',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    "Verified on 2026-10-09 that the first-party sitemap links https://www.cbnits.com/career/, which now serves the current Next.js careers route and verified careers chunk with the title Careers at CBNITS | AI & Engineering Opportunities. The component renders careers information but discards the getallCareerPost response and publishes no role cards or application links. The public API retains 19 records added in 2022 without a verified current application flow; those records are not emitted as current jobs. This is discovery-only evidence and does not establish an empty India inventory. Current route identity, the first-party chunk and its unpublished-inventory behavior are validated before returning an incomplete discovery result.",
  dryRunFile: 'cbnits/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default CBNITS_CATALOG
