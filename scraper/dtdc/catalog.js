import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://www.dtdc.com/ still redirects to the live first-party homepage at https://www.dtdc.com/in/, that the current server-rendered homepage HTML still exposes the canonical /in/ URL, the core logistics hero copy, and a first-party /career/ link even when the older homepage title tag is absent, and that https://www.dtdc.com/career/ remains a resume-drop surface instructing applicants to email careers@dtdc.com rather than browse public job listings. Verified that the current career page contains commented-out sample job cards but no trustworthy live public jobs surface, that https://www.dtdc.com/robots.txt advertises https://www.dtdc.com/sitemap_index.xml, that https://www.dtdc.com/page-sitemap.xml exposes https://www.dtdc.com/career/ as the only career-like first-party page, and that adjacent first-party routes https://www.dtdc.com/jobs/, https://www.dtdc.com/careers/, https://www.dtdc.com/join-us/, and https://www.dtdc.com/work-with-us/ returned 404 during live checks.'

export const DTDC_CATALOG = {
  source: 'dtdc',
  companyName: 'DTDC',
  officialBrandName: 'DTDC',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'dtdc/jobs.json',
  rootUrl: 'https://www.dtdc.com/',
  homepageUrl: 'https://www.dtdc.com/in/',
  companyCareerPage: 'https://www.dtdc.com/career/',
  companyDomain: 'dtdc.com',
  robotsTxtUrl: 'https://www.dtdc.com/robots.txt',
  sitemapIndexUrl: 'https://www.dtdc.com/sitemap_index.xml',
  pageSitemapUrl: 'https://www.dtdc.com/page-sitemap.xml',
  verifiedResumeDropEmail: 'careers@dtdc.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-root-redirect-plus-career-page-plus-robots-sitemap-plus-missing-job-routes',
  extractionStrategy:
    'verified-root-redirect+verified-homepage-career-link+verified-resume-drop-career-page+verified-robots-sitemap-with-single-career-url+verified-missing-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DTDC_CATALOG
