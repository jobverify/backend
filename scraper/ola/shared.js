import { runNativeOla } from './nativeRun.js'
export { API_BASE_URL,CAREER_PAGE_ID,CAREER_PAGE_URL,FILTERED_JOBS_URL,LIVE_FILTER_BODY,NOAUTH_TOKEN_URL,ORIGIN } from './nativeContract.js'

// Listing previews lack role-owned employer identity and complete criteria.
export const extractSearchResults=()=>[]
export const createTurbohireScraper=({source}={})=>({run:(options={})=>runNativeOla({...options,source})})
