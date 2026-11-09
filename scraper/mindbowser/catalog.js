import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 8, 2026 that https://www.mindbowser.com/ is the official Mindbowser homepage, that the first-party careers page at https://www.mindbowser.com/careers/ still hands applicants to the HROne short link https://hr-1.in/829c17 even though the page now also contains a separate self-referential Apply Now link, and that the verified direct HROne board URL still resolves to an opaque public career-portal shell on career.hrone.cloud for dc=mindbowser. Because the API-only runtime cannot enumerate that shell without browser execution, this provider now validates the trusted handoff and returns an honest empty result by default. Historical rendered verification from Monday, August 3, 2026 captured 6 public vacancies including JO00115 Senior Business Analyst - US Healthcare Domain (4-7 Years), JO00114 Senior AI/ML Engineer (5-7 Years), JO00109 AI Engineer (Generative AI & Machine Learning), and JO00022 Technology Role.'

export const MINDBOWSER_CATALOG = {
  source: 'mindbowser',
  companyName: 'Mindbowser',
  officialBrandName: 'Mindbowser',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mindbowser/jobs.json',
  officialHomepageUrl: 'https://www.mindbowser.com/',
  companyCareerPage: 'https://www.mindbowser.com/careers/',
  companyDomain: 'mindbowser.com',
  hroneShortUrl: 'https://hr-1.in/829c17',
  atsPlatform: 'hrone',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-opaque-hrone-shell-validation',
  extractionStrategy:
    'verified-official-careers-page+verified-hrone-handoff+api-only-empty-fallback',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedRenderedJobCount: 6,
  verifiedSampleJobId: 'JO00115',
  verifiedOn: '2026-08-08',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MINDBOWSER_CATALOG
