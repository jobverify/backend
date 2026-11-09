import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BHARAT_FRITZ_WERNER_CATALOG = {
  source: 'bharatfritzwerner',
  companyName: 'Bharat Fritz Werner',
  officialBrandName: 'BFW',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'bharatfritzwerner/jobs.json',
  companyCareerPage: 'https://bfwindia.com/careers/',
  homepageUrl: 'https://bfwindia.com/',
  careerAliasUrl: 'https://bfwindia.com/career/',
  robotsTxtUrl: 'https://bfwindia.com/robots.txt',
  sitemapIndexUrl: 'https://bfwindia.com/sitemap_index.xml',
  pageSitemapUrl: 'https://bfwindia.com/page-sitemap.xml',
  noPublicJobRouteUrls: [
    'https://bfwindia.com/jobs/',
    'https://bfwindia.com/join-us/',
    'https://bfwindia.com/work-with-us/',
  ],
  verifiedJobDetailUrls: [
    'https://bfwindia.com/careers/head-of-application-engineering-1/',
    'https://bfwindia.com/careers/head-dept/',
    'https://bfwindia.com/careers/production-planning-and-control/',
    'https://bfwindia.com/careers/supply-chain-management/',
    'https://bfwindia.com/careers/head-of-quality/',
  ],
  companyDomain: 'bfwindia.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-single-careers-page-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-page+visible-open-positions-list+same-domain-detail-pages+inline-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://bfwindia.com/ is the live first-party BFW homepage for the backlog company name Bharat Fritz Werner, and that it links directly to the trusted first-party careers surface at https://bfwindia.com/careers/. Verified that https://bfwindia.com/career/ redirects into the same careers page, that the visible Positions open block on https://bfwindia.com/careers/ currently lists Head of Application Engineering, Head / Dept Lead, Production Planning and Control (PPC), Supply Chain Management (SCM), and Head of Quality, and that those openings link to https://bfwindia.com/careers/head-of-application-engineering-1/, https://bfwindia.com/careers/head-dept/, https://bfwindia.com/careers/production-planning-and-control/, https://bfwindia.com/careers/supply-chain-management/, and https://bfwindia.com/careers/head-of-quality/ respectively. Verified that each detail page stays on the official domain and includes an inline first-party application form. Verified that https://bfwindia.com/robots.txt points to https://bfwindia.com/sitemap_index.xml and that https://bfwindia.com/page-sitemap.xml still publishes additional historical careers URLs, so the trusted public jobs surface is the visible Positions open block rather than the full sitemap. Verified that https://bfwindia.com/jobs/, https://bfwindia.com/join-us/, and https://bfwindia.com/work-with-us/ returned first-party 404 pages titled Page not found - BFW.',
}

export default BHARAT_FRITZ_WERNER_CATALOG
