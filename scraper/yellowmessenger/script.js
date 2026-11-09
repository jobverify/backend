import { createZohoNativeInventoryScraper } from '../../scraper-support/utils/zohoNativeInventory.js'

export const SOURCE = 'yellowmessenger'
export const COMPANY = 'Yellow Messenger'
export const OFFICIAL_BRAND = 'Yellow.ai'
export const CAREERS_URL = 'https://yellow.ai/career/'
export const EMBEDDED_ZOHO_SITE_URL = 'https://careers.yellow.ai'
export const DISPOSITION = 'current-first-party-native-zoho-inventory'
export const VERIFIED_SURFACE_SUMMARY = 'Current Yellow.ai careers embed binds its exact first-party Zoho organization/page. Runtime reads and reconciles the complete board, native API, full active details and closing state; inactive records and unknown scope cannot fabricate India vacancies.'

export const createYellowMessengerScraper = (options = {}) => createZohoNativeInventoryScraper({
  source: SOURCE, company: COMPANY, nativeCompany: OFFICIAL_BRAND, companyDomain: 'yellow.ai',
  officialUrl: CAREERS_URL, officialBinding: 'zoho-native-embed', boardUrl: EMBEDDED_ZOHO_SITE_URL + '/jobs/Careers',
  orgId: '157454000000312523', pageId: '157454000000312673', allowBlankNativeWebsite: true,
}, options)
export const run = async (options = {}) => createYellowMessengerScraper(options).run(options)
