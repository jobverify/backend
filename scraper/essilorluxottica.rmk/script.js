import { runCurrentRmkCountryFacet } from '../../scraper-support/utils/recruitmentRmkCountryFacet.js'
export const SOURCE = 'essilorluxottica'
export const COMPANY = 'EssilorLuxottica'
export const run = options => runCurrentRmkCountryFacet(SOURCE, options)
export default { run }
