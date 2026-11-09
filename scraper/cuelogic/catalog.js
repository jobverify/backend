import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified October 3, 2026: the official LTM careers page links to the LTIMindtree Ripplehire India board. A Cuelogic query on its public search API returns zero roles while the unfiltered India query returns 530. The prior careers.ltimindtree.com host no longer resolves.'

export const CUELOGIC_CATALOG = {
  source: 'cuelogic',
  companyName: 'Cuelogic',
  officialBrandName: 'LTM',
  adapter: 'script',
  homepageUrl: 'https://www.ltm.com/careers',
  companyCareerPage: 'https://www.ltm.com/careers',
  boardUrl: 'https://ltimindtree.ripplehire.com/candidate/?token=xviyQvbnyYZdGtozXoNm&lang=en&source=CAREERSITE#list/geo=India',
  companyDomain: 'ltm.com',
  atsPlatform: 'ripplehire-empty-search-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'parent-board-search-query',
  extractionStrategy:
    'official-parent-ripplehire-india-search-with-unfiltered-control-query',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'cuelogic/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CUELOGIC_CATALOG
