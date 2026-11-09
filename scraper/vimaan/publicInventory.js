import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
export const LISTINGS_URL='https://vimaan.ai/jm-ajax/get_listings/'
const clean=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
export const defaultFetchListings=async params=>{
  const response=await fetch(LISTINGS_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/json'},body:new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)])),signal:AbortSignal.timeout(30000)})
  if(!response.ok) throw new Error('Vimaan public jobs API returned HTTP '+response.status)
  return response.json()
}
export const verifyPublicInventory=async(fetchListings=defaultFetchListings)=>{
  const seen=new Set(); let expectedPages=null; let total=0
  for(let page=1;page<=100;page++){
    const data=await fetchListings({search_keywords:'',search_location:'',per_page:10,orderby:'featured',order:'DESC',page,show_pagination:false,form_data:''})
    if(typeof data?.found_jobs!=='boolean'||!Number.isInteger(data.max_num_pages)||data.max_num_pages<0||typeof data.html!=='string') throw new Error('Vimaan public jobs inventory response changed')
    const pages=Math.max(1,data.max_num_pages)
    if(pages>100||expectedPages!==null&&pages!==expectedPages) throw new Error('Vimaan public jobs pagination is incomplete or changed')
    expectedPages=pages
    const cards=[...data.html.matchAll(/<li\b[^>]*class=["'][^"']*\bjob_listing\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
    if(data.found_jobs!==Boolean(cards.length)) throw new Error('Vimaan public jobs listing count could not be verified')
    if(cards.length && data.max_num_pages===0 || !cards.length && (pages!==1 || page!==1 || total!==0)) throw new Error('Vimaan public jobs pagination is incomplete or contradicts the empty inventory')
    if(!cards.length&&!/no_jobs_found|no jobs found|class=["'][^"']*\bno_job_listings_found\b[^"']*["']/i.test(data.html)) throw new Error('Vimaan empty jobs response lacks an explicit no-jobs marker')
    for(const card of cards){
      const id=card[0].match(/\bpost-(\d+)\b/)?.[1]
      const href=card[1].match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1]
      const title=clean(card[1].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
      const location=clean(card[1].match(/<div\b[^>]*class=["']location["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
      let url; try{url=new URL(href)}catch{}
      if(!id||!title||!location||url?.origin!=='https://vimaan.ai'||!/^\/job\/[^/]+\/$/.test(url.pathname)||seen.has(id)) throw new Error('Vimaan public job identity or pagination changed')
      seen.add(id);total++
      // The current complete board publishes a US-only role. Future India or
      // geographically ambiguous cards require detail validation before export.
      if(!/^San Jose,\s*CA(?:,?\s*(?:USA|United States))?$/i.test(location)){
        const error=new Error('Vimaan public listing country scope requires validation: '+location);error.failureKind='incomplete_location_scope';error.abortRetries=true;throw error
      }
    }
    if(page===pages) return attachInventoryEvidence([],{status:total?'complete-inventory':'verified-empty',surface:LISTINGS_URL,firstParty:true,listingComplete:true,pagesFetched:page,reportedTotal:total,indiaFacetCount:0,verifiedAt:new Date().toISOString(),reason:total?'Unfiltered WordPress Job Manager inventory; all current roles have verified US locations':'Unfiltered WordPress Job Manager inventory returned an explicit no-listings marker'})
  }
  throw new Error('Vimaan public jobs pagination exceeded its limit')
}
