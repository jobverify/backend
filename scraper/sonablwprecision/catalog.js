import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 26, 2026 that the old https://sonacomstar.com/career route still appears in the sitemap and from the live https://sonacomstar.com/our-culture page "Join Us" CTA, but the linked /career destination currently responds with HTTP 404 instead of a trustworthy public jobs surface. The live first-party https://sonacomstar.com/our-culture page still carries the official Sona Comstar branding, "Life @Sona Comstar", and "Explore a career with sona comstar" copy, while the legal-entity footer on https://sonacomstar.com/pages/about-us still identifies the company as Sona BLW Precision Forgings Limited and now links the cautionary notice PDF at https://sonacomstar.com/files/policy/Cautionary_Notice_Against_Fake_Employment_Offers_etc.pdf. This provider intentionally fails closed and returns an empty array until a trustworthy public jobs surface appears.'

export const SONA_BLW_PRECISION_CATALOG = {
  source: 'sonablwprecision',
  companyName: 'Sona BLW Precision',
  officialBrandName: 'Sona BLW Precision Forgings Limited (Sona Comstar)',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sonablwprecision/jobs.json',
  companyCareerPage: 'https://sonacomstar.com/our-culture',
  officialCompanyPageUrl: 'https://sonacomstar.com/pages/about-us',
  officialCulturePageUrl: 'https://sonacomstar.com/our-culture',
  cautionNoticeUrl:
    'https://sonacomstar.com/files/policy/Cautionary_Notice_Against_Fake_Employment_Offers_etc.pdf',
  companyDomain: 'sonacomstar.com',
  atsPlatform: 'official-company-site-culture-page-broken-career-route-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-culture-page-plus-linked-career-404-plus-legal-entity-footer-checks',
  extractionStrategy:
    'verified-culture-page+linked-career-404+footer-legal-entity+cautionary-notice-no-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-26',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SONA_BLW_PRECISION_CATALOG
