import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLEETX_CATALOG = {
  source: 'fleetx',
  companyName: 'Fleetx',
  officialBrandName: 'Fleetx',
  adapter: 'script',
  homepageUrl: 'https://www.fleetx.ai/',
  wwwHomepageUrl: 'https://www.fleetx.ai/',
  companyCareerPage: 'https://www.fleetx.ai/careers',
  wwwCareerPageUrl: 'https://www.fleetx.ai/careers',
  robotsUrl: 'https://fleetx.io/robots.txt',
  wwwRobotsUrl: 'https://www.fleetx.io/robots.txt',
  sitemapUrl: 'https://fleetx.io/sitemap.xml',
  wwwSitemapUrl: 'https://www.fleetx.io/sitemap.xml',
  timeoutProbeUrls: [
    'https://fleetx.io/',
    'https://www.fleetx.io/',
    'https://fleetx.io/careers',
    'https://www.fleetx.io/careers',
    'https://fleetx.io/career',
    'https://www.fleetx.io/career',
    'https://fleetx.io/jobs',
    'https://www.fleetx.io/jobs',
    'https://fleetx.io/join-us',
    'https://www.fleetx.io/join-us',
    'https://fleetx.io/work-with-us',
    'https://www.fleetx.io/work-with-us',
    'https://fleetx.io/robots.txt',
    'https://www.fleetx.io/robots.txt',
    'https://fleetx.io/sitemap.xml',
    'https://www.fleetx.io/sitemap.xml',
  ],
  companyDomain: 'fleetx.ai',
  atsPlatform: 'first-party-current-native-SSR-vacancies-and-published-resume-intake',
  countryFilter: 'India',
  paginationStrategy:
    'paired-current-own-SSR-publication;unqualified-company-inventory',
  extractionStrategy:
    'current-scoped-native-vacancy-cards+published-resume-intake+independent-whole-role-municipal-country-proof;explicit-partials',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
  verifiedOn: null,
  verifiedJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Current own SSR vacancies at https://www.fleetx.ai/careers close independently with their published resume-email intake and exact whole role municipal/state workplaces corroborated by retained official references. Native ambiguous Hyderabad-only remains held. Every accepted record is partial; no native requisition/per-role URL, complete criteria, exact legal employer, company-wide counts, full application controls/backend or lifecycle replacement is asserted. All original fields, workplace alternatives, criteria and authored dates are retained. Historical discovery routes are diagnostic and are never read by the current production collector.',
  nativeCareersPage: 'https://www.fleetx.ai/careers',
  zeroResultPolicy: 'evidence-required',
  dryRunFile: 'fleetx/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FLEETX_CATALOG
