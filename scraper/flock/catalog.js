import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLOCK_CATALOG = {
  source: 'flock',
  companyName: 'Flock',
  adapter: 'script',
  homepageUrl: 'https://www.flock.com/',
  homepageCareersLinkUrl: 'https://careers.flock.com/',
  companyCareerPage: 'https://careers.flock.com/',
  companyDomain: 'flock.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-shell-without-public-role-cards',
  extractionStrategy:
    'verified-homepage-careers-link+verified-careers-shell-with-search-controls-and-work-email+verified-no-public-role-cards-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that the live Flock homepage at https://www.flock.com/ still links Careers to the first-party careers site at https://careers.flock.com/ (currently exposed on-page as http://careers.flock.com/ but canonically normalized to HTTPS), and that the first-party careers page still shows the shell text "Join the Team", filter controls for "All teams" and "All locations", the control label "Search Jobs", and the fallback recruiting contact work@flock.com. The public careers shell still does not expose visible role cards, role detail links, or a trustworthy public ATS handoff, so no trustworthy public jobs surface is currently available.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FLOCK_CATALOG
