import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ISKILLBOX_CATALOG = {
  source: 'iskillbox',
  companyName: 'iSkillBox',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://iskillbox.com/career/',
  officialHomepageUrl: 'https://iskillbox.com/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-contact-style-career-shell-validation',
  extractionStrategy:
    'verified-homepage+verified-contact-style-career-shell-without-public-job-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'iskillbox.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://iskillbox.com/ is the live exact-name iSkillBox homepage and that https://iskillbox.com/career/ is the live first-party Career page. The verified career page title now renders as "Career &#8211; iSkillbox Corporate Training", but it remains a contact-style shell for ISKILLBOX LEARNING TECHNOLOGIES PRIVATE LIMITED with phone and office-address details and still does not expose public job cards, job detail pages, ATS handoffs, or other trustworthy public listings. There is no trustworthy public jobs surface on the exact-name iSkillBox domain.',
  dryRunFile: 'iskillbox/jobs.json',
}

export default ISKILLBOX_CATALOG
