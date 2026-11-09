import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 19, 2026 that https://scripbox.com/pages/careers is the live official Scripbox careers page, that it renders a public Job Openings section plus Get In Touch content, that the page embeds current openings in a Next.js __NEXT_DATA__ jobOpenings array, and that rendered Apply links now hand candidates to the official Darwinbox candidatev2 detail routes under https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails. The verified first-party page exposed 8 public India openings including Associate, Software Development Engineer in Test, Senior Relationship Manager, Associate Vice President, Social Media Manager, Relationship Manager, and Sales Development Representative.'

export const SCRIPBOX_CATALOG = {
  source: 'scripbox',
  companyName: 'Scripbox',
  officialBrandName: 'Scripbox',
  adapter: 'script',
  homepageUrl: 'https://scripbox.com/',
  companyCareerPage: 'https://scripbox.com/pages/careers',
  publicBoardUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  verifiedSampleJobUrl:
    'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
  companyDomain: 'scripbox.com',
  atsPlatform: 'official-company-careers-embedded-next-data-darwinbox-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-embedded-next-data',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-next-data-jobopenings-array+darwinbox-detail-links+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'scripbox/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SCRIPBOX_CATALOG
