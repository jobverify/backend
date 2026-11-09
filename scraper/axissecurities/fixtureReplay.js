import {readFileSync} from 'node:fs'
const load=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url),'utf8'))
const listings=load('listing-json-responses'),details=load('detail-responses')
export const fixtureFetch=(change=(record)=>record)=>async(url,init={})=>{
 let record,kind
 if(url.includes('simplehai.axisdirect.in')){record=load('careers-response');kind='official'}
 else if(url.includes('getcandidatecompanydetails')){record=load('company-json-response');kind='company'}
 else if(url.includes('candidatejobsearch')){record=listings[JSON.parse(new URLSearchParams(init.body).get('careerSiteUrlParams')).page];kind='listing'}
 else if(url.includes('candidatejobdetail')){record=details.find(r=>new URL(r.url).searchParams.get('jobSeq')===new URL(url).searchParams.get('jobSeq'));kind='detail'}
 else{record=load('board-response');kind='board'}
 if(!record)throw Error('Uncaptured Axis request '+url)
 const changed=change({...record},kind,url),response=new Response(changed.body,{status:changed.status})
 Object.defineProperty(response,'url',{value:changed.finalUrl});return response
}
