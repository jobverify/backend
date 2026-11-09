import {document,decode,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,oneNative,plainNativeHTML,nativeDate,readNativeJobPosting,nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='bearingpoint',COMPANY='BearingPoint',ORIGIN='https://bearingpointindia.teamtailor.com',BOARD=ORIGIN+'/jobs'
export const CORPORATE='https://www.bearingpoint.com/en-in/careers/open-roles/?country=IN'
const ensure=(v,m)=>requireNative(v,'BearingPoint: '+m),key=v=>norm(v).toLowerCase()
const relayBase='https://www.bearingpoint.com/en-in/careers/open-roles/job-offer-successfactors/'
const rolePattern=/^https:\/\/bearingpointindia\.teamtailor\.com\/jobs\/([1-9]\d{4,12})-([a-z0-9]+(?:-[a-z0-9]+)*)$/
export function readOffsetDate(value,options={}){
 if(typeof value!=='string'||!/[+-]\d{2}:\d{2}$/.test(value))return nativeDate(value,options)
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?([+-])(\d{2}):(\d{2})$/.exec(value)
 ensure(m,'Unsupported native offset date')
 const hh=Number(m[5]),mm=Number(m[6]);ensure(hh<=14&&mm<60&&(hh<14||mm===0),'Impossible native timezone offset')
 const civil=m[1]+'T'+m[2]+'.'+(m[3]||'').padEnd(3,'0')+'Z',local=new Date(civil)
 ensure(Number.isFinite(+local)&&local.toISOString()===civil,'Impossible native calendar/time')
 const offset=(hh*60+mm)*60000*(m[4]==='+'?1:-1),instant=new Date(+local-offset)
 ensure(Number.isFinite(+instant)&&new Date(value).getTime()===+instant,'Native offset instant mismatch')
 return{raw:value,iso:instant.toISOString(),precision:m[3]?'millisecond':'second',exact:true}
}
function fields(doc){
 const dl=oneNative(doc.nodes(n=>n.tag==='dl'),'native role attributes'),nodes=dl.children.filter(n=>typeof n!=='string'&&['dt','dd'].includes(n.tag)),result=new Map()
 ensure(nodes.length>0&&nodes.length%2===0,'Native role attributes unavailable')
 for(let i=0;i<nodes.length;i+=2){ensure(nodes[i].tag==='dt'&&nodes[i+1].tag==='dd','Native attribute structure changed');const k=doc.text(nodes[i]);ensure(k&&!result.has(k),'Duplicate native attribute');result.set(k,doc.text(nodes[i+1]))}
 return result
}
export function createSourceConfig({now=()=>new Date().toISOString()}={}){
 const current=Date.parse(now());ensure(Number.isFinite(current),'Invalid collection clock')
 let relayURL,relayID,officialRoleURL
 const allowedRoles=new Set()
 const config={source:SOURCE,companyName:COMPANY,boardURL:BOARD,
  sameReadIdentity(from,to){return from===to||from===relayURL&&to===relayURL+'&country=IN'},
  validateURL(value){
   if(value===CORPORATE||value===BOARD||relayURL&&(value===relayURL||value===relayURL+'&country=IN')||allowedRoles.has(value))return
   ensure(false,'Unqualified public endpoint')
  },
  handoffs:[
   {url:CORPORATE,verify(html){
    const doc=document(html),urls=[...new Set(doc.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').map(n=>new URL(n.attrs.href,CORPORATE).href).filter(u=>u.startsWith(relayBase+'?id=T')&&/^T[1-9]\d{4,12}$/.test(new URL(u).searchParams.get('id')||'')&&new URL(u).searchParams.size===1))]
    ensure(urls.length>0,'Current official India role links missing');relayURL=urls[0];relayID=new URL(relayURL).searchParams.get('id').slice(1)
   }},
   {get url(){return relayURL},verify(html){
    const doc=document(html),links=[...new Set(doc.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&n.attrs.href.startsWith(ORIGIN+'/jobs/'+relayID+'-')).map(n=>n.attrs.href))]
    ensure(links.length===1&&links[0].endsWith('/applications/new'),'Current official-to-native job handoff missing')
    officialRoleURL=links[0].slice(0,-'/applications/new'.length);ensure(rolePattern.exec(officialRoleURL)?.[1]===relayID,'Native handoff changes public job identity')
   }},
  ],
  parseListing(html,url){
   ensure(url===BOARD,'Unqualified listing page')
   const doc=document(html),frames=doc.nodes(n=>n.tag==='turbo-frame'&&n.attrs.id==='jobs_list');ensure(frames.length===1&&!frames[0].attrs.src,'Native listing frame unavailable')
   const container=oneNative(doc.nodes(n=>n.tag==='ul'&&n.attrs.id==='jobs_list_container',frames[0]),'native jobs container')
   const counts=doc.nodes(n=>n.tag==='h2'&&/^\d+ jobs?$/.test(doc.text(n)),frames[0]);ensure(counts.length===1,'Native reported total unavailable')
   const total=Number(doc.text(counts[0]).split(' ')[0]);ensure(Number.isSafeInteger(total)&&total>=0&&total<=1000,'Native listing bound')
   ensure(!doc.nodes(n=>(n.attrs.rel||'').split(/\s+/).includes('next')||n.attrs['data-controller']?.includes('load-more')||n.tag==='turbo-frame'&&n.attrs.src,frames[0]).length,'Native pagination changed;complete traversal unproven')
   const ids=new Set(),records=container.children.filter(n=>typeof n!=='string').map(li=>{
    ensure(li.tag==='li','Unexpected native listing row')
    const anchor=oneNative(doc.nodes(n=>n.tag==='a',li),'native public role link'),href=anchor.attrs.href,match=rolePattern.exec(href||'')
    ensure(match&&!ids.has(match[1]),'Duplicate or foreign native role link');ids.add(match[1]);allowedRoles.add(href)
    const meta=oneNative(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'text-md')&&doc.hasClass(n,'mt-4'),li),'native card attributes')
    const values=meta.children.filter(n=>typeof n!=='string'&&n.tag==='span'&&!doc.hasClass(n,'mx-[2px]')).map(n=>doc.text(n))
    ensure(values.length===3&&values.every(Boolean),'Native card location/department/remote state unavailable')
    const title=doc.text(anchor);ensure(title,'Native listing title unavailable')
    return{id:match[1],url:href,title,locations:[values[1]],countries:[],nativeDepartment:values[0],nativeRemoteStatus:values[2]}
   })
   ensure(records.length===total,'Native displayed total does not reconcile;pagination/truncation unresolved')
   ensure(total===0||records.some(r=>r.url===officialRoleURL),'Current official/native job identity does not reconcile')
   return{pageNumber:1,lastPage:1,reportedTotal:total,observedRows:records.length,records,nextURL:null,terminationKnown:true}
  },
  pageFingerprint:p=>JSON.stringify({total:p.reportedTotal,records:p.records}),candidateForIndia:()=>true,
  identifierName:'BearingPoint India',requireSchemaIdentifier:true,acceptedHiringOrganizations:['BearingPoint India'],
  visibleTitle(doc){const titles=[...new Set(doc.nodes(n=>n.tag==='h1').map(n=>doc.text(n)))];return oneNative(titles,'native visible title')},
  rolePageText(doc){return doc.text(oneNative(doc.nodes(n=>n.tag==='main'&&n.attrs.id==='main-content'),'native role main'))},
  visibleDescriptionHTML(doc){return doc.inner(oneNative(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'prose')&&n.attrs['data-controller']==='careersite--responsive-video'),'native role description'))},
  compareDescriptions:(visible,schema)=>plainNativeHTML(visible).replace(/\s+/g,'')===plainNativeHTML(decode(schema)).replace(/\s+/g,''),
  visibleLocations(doc){const f=fields(doc),location=f.get('Location');ensure(location&&!f.has('Locations'),'Native role location unavailable');return[location]},
  readNativeDate:readOffsetDate,
  applicationEvidence(doc,posting,row){
   const main=oneNative(doc.nodes(n=>n.tag==='main'&&n.attrs.id==='main-content'),'native role main'),url=main.attrs['data-careersite--jobs--form-overlay-job-application-url-value']
   ensure(main.attrs['data-careersite--jobs--form-overlay-job-id-value']===row.id&&url===row.url+'/applications/new','Native application/public job identity mismatch')
   ensure(doc.nodes(n=>['a','button'].includes(n.tag)&&doc.text(n)==='Apply for this job',main).length>0,'Native application action unavailable')
   return{nativeApplicationURL:url,internalEmployeeBoardLinks:[]}
  },
  parseDetail(html,row){
   const fact=readNativeJobPosting(html,row,config),doc=document(html),f=fields(doc)
   ensure(fact.nativeHiringOrganization.sameAs===ORIGIN,'Native employer origin mismatch')
   ensure(fact.nativeCountryAddresses.every(a=>row.locations.some(l=>key(l)===key(a.raw.addressLocality))),'Native visible/schema locality mismatch')
   ensure(fact.nativePostedDate.iso&&Date.parse(fact.nativePostedDate.iso)<=current,'Future native publication date')
   ensure(f.get('Department')===row.nativeDepartment&&f.get('Remote status')===row.nativeRemoteStatus,'Native role/card attributes mismatch')
   return{...fact,nativeDepartment:f.get('Department'),nativeRemoteStatus:f.get('Remote status'),nativeRoleAttributes:Object.fromEntries(f)}
  },
  projectJobs(result,c){return nativePostingJobs(result,c).map(job=>({...job,locations:[...new Set(job.nativeFacts.nativeCountryAddresses.filter(a=>a.country==='India').map(a=>[a.raw.addressLocality,'India'].join(', ')))],remoteStatus:{Hybrid:'Hybrid','Fully remote':'Remote','No remote work':'On-site'}[job.nativeFacts.nativeRemoteStatus]||null,nativeRemoteStatus:job.nativeFacts.nativeRemoteStatus,nativeDepartment:job.nativeFacts.nativeDepartment}))},
 }
 return config
}
