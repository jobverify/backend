import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://www.splunk.com/en_us/careers/search-jobs.hml.html remained a live first-party Splunk entry point, that it now brands as "Working at Splunk - Cisco Careers" and hands applicants to the first-party Cisco-hosted search page at https://careers.cisco.com/global/en/splunk/search-page, that the live embedded global search payload on that page exposed 80 public Splunk openings including an India country bucket with 1 opening, and that the first-party India route at https://careers.cisco.com/global/en/splunk/india was live and its embedded India-filtered payload returned 1 Bangalore, India hit.'

export const SPLUNK_CATALOG = {
  source: 'splunk',
  companyName: 'Splunk',
  officialBrandName: 'Splunk',
  adapter: 'script',
  companyCareerPage: 'https://www.splunk.com/en_us/careers/search-jobs.hml.html',
  companyDomain: 'splunk.com',
  canonicalCareersLandingUrl: 'https://careers.cisco.com/global/en/splunk',
  officialSearchPageUrl: 'https://careers.cisco.com/global/en/splunk/search-page',
  indiaJobsPageUrl: 'https://careers.cisco.com/global/en/splunk/india',
  atsPlatform: 'official-first-party-cisco-careers-search',
  countryFilter: 'India',
  paginationStrategy:
    'verified-first-party-splunk-entry-plus-cisco-search-pages-with-embedded-json-live-india-results',
  extractionStrategy:
    'verified-splunk-first-party-entry+verified-cisco-search-page-embedded-json+verified-india-filtered-results',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedPublicJobCount: 80,
  verifiedIndiaJobCount: 1,
  verifiedSampleJobUrl:
    'https://careers.cisco.com/global/en/job/2021623/Solution-Test-Technical-Lead-Python-Java-Programming-UI-Automation-Network-Protocols-AWS-Splunk-Kubernetes-Linux-Wireshark-AI-8-to-12-years-Bangalore',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'splunk/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SPLUNK_CATALOG
