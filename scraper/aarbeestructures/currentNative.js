import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {collectContext,activeLinks,norm,fail} from '../aadyahaerospace/publicSource.js'
const ENTRY='https://aarbeestructures.com/careers/',CONFIG={source:'aarbeestructures',company:'Aarbee Structures Pvt. Ltd.',entry:ENTRY}
export function model(html){
 const doc=document(html),text=doc.text(doc.root),links=activeLinks(html,ENTRY)
 if(!/Aarbee Structures Pvt\.?\s*Ltd\.?/i.test(text)||!/Aarbee Career/i.test(text))throw fail('Aarbee official careers identity changed')
 const form=links.find(row=>/work with us/i.test(row.text)),email=links.find(row=>row.url.toLowerCase()==='mailto:careers@aarbeestructures.com')
 if(!form||!email)throw fail('Aarbee public hiring entry changed')
 const url=new URL(form.url)
 if(url.origin!=='https://docs.google.com'||!/^\/forms\/d\/e\/[\w-]+\/viewform$/.test(url.pathname)||url.search||url.hash)throw fail('Aarbee public application handoff identity changed')
 return{applicationUrl:url.href,email:'careers@aarbeestructures.com',label:norm(form.text)}
}
export const createCurrentScraper=()=>({run:options=>collectContext(CONFIG,options||{},async scope=>{
 const first=model(await scope.read(ENTRY,'html','initial')),last=model(await scope.read(ENTRY,'html','closing'))
 return scope.finish({observations:[{kind:'general-resume-application-entry',url:ENTRY,vacancy:false,country:null,postingDate:null,descriptionComplete:false,...first}],
  nativeContext:{applicationActionPerformed:false,applicationPageFetched:false,applicationAccessEvaluated:false,applicationHandoff:first,upstreamApplicationInventory:'unknown-without-a-public-native-role-feed'},
  closingMatches:JSON.stringify(first)===JSON.stringify(last),reason:'public-careers-form-email-entry-without-public-native-vacancy-inventory'})
})})
