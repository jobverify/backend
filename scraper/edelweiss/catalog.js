import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://www.edelweissfin.com/ is the live first-party Edelweiss homepage and links Careers to https://www.edelweissfin.com/edelweisscareers. Verified that the first-party careers page titled "Careers At Edelweiss" is an informational employer-branding surface with "CAREERS AT EDELWEISS", "LIFE AT EDELWEISS", and a resume handoff telling candidates to send CVs to GroupTalent.Acquisition@edelweissfin.com, but it does not expose public job cards, role detail pages, ATS handoffs, or JobPosting markup. Verified that https://www.edelweissfin.com/robots.txt now returns a first-party 404 shell, that https://www.edelweissfin.com/sitemap.xml redirects to https://www.edelweissfin.com/sitemap_index.xml, and that the legacy career-like routes /careers, /career, /jobs, /join-us, and /work-with-us do not expose public jobs. No trustworthy public jobs surface is currently available for Edelweiss.'

export const EDELWEISS_CATALOG = {
  source: 'edelweiss',
  companyName: 'Edelweiss',
  officialBrandName: 'Edelweiss',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'edelweiss/jobs.json',
  homepageUrl: 'https://www.edelweissfin.com/',
  companyCareerPage: 'https://www.edelweissfin.com/edelweisscareers',
  companyDomain: 'edelweissfin.com',
  applicationEmail: 'GroupTalent.Acquisition@edelweissfin.com',
  applicationUrl: 'mailto:GroupTalent.Acquisition@edelweissfin.com',
  atsPlatform: 'official-company-general-cv-intake-with-unqualified-vacancy-inventory',
  countryFilter: 'India',
  paginationStrategy:
    'current-own-home-and-career-model-opening-closing-reconciliation-with-native-http-admission',
  extractionStrategy:
    'current-first-party-career-general-cv-model+protected-contact-and-inventory-holds+observed-denial-preserved',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EDELWEISS_CATALOG
