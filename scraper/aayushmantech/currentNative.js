import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {collectContext,activeLinks,fail} from '../aadyahaerospace/publicSource.js'
const HOME='https://www.aayushmantech.com/',COMPANY=HOME+'company',CONFIG={source:'aayushmantech',company:'Aayushman Tech',entry:HOME}
export function model(html,url){
 const doc=document(html),text=doc.text(doc.root),links=activeLinks(html,url)
 if(!/Aayushman Tech Services Pvt\. Ltd\./i.test(text)||!/Aayushman/i.test(text))throw fail('Aayushman official company identity changed')
 const careers=links.filter(row=>new URL(row.url).origin===new URL(HOME).origin&&/^\/(?:careers?|jobs?|join-us|openings|hiring)(?:\/|$)/i.test(new URL(row.url).pathname))
 const excludedSocialLinks=links.filter(row=>/linkedin\.com\/company\/wix-com|facebook\.com\/WixStudio|instagram\.com\/wixstudio|twitter\.com\/wix/i.test(row.url)).map(row=>row.url)
 return{commercialServiceCopy:/Hire Experienced Developers/i.test(text)?'Hire Experienced Developers':null,
  excludedSocialLinks:[...new Set(excludedSocialLinks)].sort(),companyLink:links.some(row=>row.url===COMPANY),possible:careers.map(row=>({kind:'unreviewed-public-hiring-entry',url:row.url}))}
}
export const createCurrentScraper=()=>({run:options=>collectContext(CONFIG,options||{},async scope=>{
 const snapshot=async phase=>({home:model(await scope.read(HOME,'html',phase),HOME),company:model(await scope.read(COMPANY,'html',phase),COMPANY)})
 const first=await snapshot('initial'),last=await snapshot('closing')
 if(!first.home.companyLink||!last.home.companyLink)throw fail('Aayushman current corporate page authority changed')
 return scope.finish({observations:[],nativeContext:{commercialServiceCopy:first.home.commercialServiceCopy,excludedSocialLinks:first.home.excludedSocialLinks,
  companyContext:first.company,hiringEntryIdentified:false,applicationActionPerformed:false},possible:[...first.home.possible,...first.company.possible,...last.home.possible,...last.company.possible],
  closingMatches:JSON.stringify(first)===JSON.stringify(last),reason:'public-company-marketing-context-without-an-authoritative-hiring-inventory'})
})})
