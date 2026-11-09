import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const JUEGO_STUDIO_CATALOG = {
  source: 'juegostudio',
  companyName: 'Juego Studio',
  officialBrandName: 'Juego Studio',
  adapter: 'script',
  homepageUrl: 'https://www.juegostudio.com/',
  companyCareerPage: 'https://www.juegostudio.com/careers',
  publicApplicationUrl: 'https://jhub.juegostudio.com/?module=interview&component=application',
  companyDomain: 'juegostudio.com',
  atsPlatform: 'first-party-open-positions-page-with-jhub-application-fallback',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-positions-page',
  extractionStrategy: 'first-party-html-opening-sections-or-jhub-application-options+apply-link-extraction+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedPublicJobCount: 6,
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.juegostudio.com/careers still publicly exposes an OPEN POSITIONS section with 6 attributable roles including 3D Artist I / II, Lead Animator, and UI UX Designer. When the first-party page is Cloudflare-blocked from this environment, the linked public JHub application form at https://jhub.juegostudio.com/?module=interview&component=application still enumerates the same six openings and acts as the verified local fallback surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default JUEGO_STUDIO_CATALOG
