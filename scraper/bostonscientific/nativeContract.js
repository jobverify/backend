import {extractActiveDescription,activeHead,activeScripts} from './nativeContent.js'
export const ORIGIN='https://bostonscientific.eightfold.ai'
const proof=(ok,message)=>{if(!ok)throw new Error('Boston Scientific native contract: '+message)}
const countryPairs={US:'United States',IN:'India',CA:'Canada',CR:'Costa Rica',BR:'Brazil',AU:'Australia',CO:'Colombia',IE:'Ireland',PH:'Philippines',AE:'United Arab Emirates',RO:'Romania',PL:'Poland',TH:'Thailand',MY:'Malaysia',KR:'Korea (the Republic of)',IT:'Italy',SG:'Singapore',ES:'Spain',ID:'Indonesia',DK:'Denmark',CH:'Switzerland',IL:'Israel',DE:'Germany',GB:'United Kingdom',NL:'Netherlands',PE:'Peru',ZA:'South Africa',FR:'France',HK:'Hong Kong',MX:'Mexico',JP:'Japan',SA:'Saudi Arabia',VN:'Viet Nam',CZ:'Czech Republic',BE:'Belgium',FI:'Finland',SE:'Sweden',TR:'Turkey'}
const names=new Map(Object.entries(countryPairs).flatMap(([code,name])=>[[name,code],[code,code]]));names.set('USA','US')
const country=value=>names.get(value.trim())
const city=value=>value.trim().replace(/\s+[A-Z]{2}-[A-Z0-9]+$/,'').toLowerCase().replace(/^gurgaon$/,'gurugram')
function rawLocation(value,standard){
 proof(typeof value==='string'&&value.trim(),'Missing native location')
 proof(!/\b(?:worldwide|anywhere|distributed|global\s+(?:remote|locations?)|any\s+location)\b/i.test(value),'Unbounded native location scope')
 const parts=value.split('|').map(s=>s.trim());proof(parts.length<=2,'Unknown native location separator')
 const primaryParts=parts[0].split(',').map(s=>s.trim()),primary=country(primaryParts.at(-1));proof(primary,'Unknown native primary country')
 for(const segment of primaryParts.slice(0,-1)){const explicit=country(segment),stateCorroborated=primary==='US'&&segment==='CA'&&typeof standard==='string'&&/,\s*CA,\s*US$/.test(standard);proof(stateCorroborated||!explicit||explicit===primary,'Conflicting explicit native country');for(const m of segment.matchAll(/\b([A-Z]{2})-[A-Z0-9]+\b/g))proof(names.has(m[1])&&m[1]===primary,'Native country/state prefix conflict')}
 // The current feed also emits "India-Haryana, Gurgaon" as a single
 // state/locality address. Only collapse that comma when both the primary
 // locality and the independent standardized HR/IN address corroborate it.
 const stateCity=/^India-Haryana,\s*([^,]+)$/.exec(parts[1]||'')
 const secondary=stateCity&&primary==='IN'&&city(stateCity[1])===city(primaryParts[0])
  &&typeof standard==='string'&&/,\s*HR,\s*IN$/.test(standard)&&city(standard.split(',')[0])===city(stateCity[1])
  ?'India-'+stateCity[1]:parts[1]
 const extras=secondary&&secondary!=='N/A'?secondary.split(',').map(s=>s.trim()).filter(s=>s!=='N/A'):[]
 const extra=extras.map(label=>{const prefix=[...names.keys()].sort((a,b)=>b.length-a.length).find(n=>label.startsWith(n+'-'));proof(prefix,'Unknown secondary country');const code=names.get(prefix),local=label.slice(prefix.length+1).replace(/^[A-Z0-9]{1,3}-/,'');proof(local&&!/\b(?:global|worldwide|anywhere|distributed)\b/i.test(local),'Unknown secondary location');return{code,city:city(local),label}})
 return{primary,primaryCity:city(primaryParts[0]),extra,codes:[primary,...extra.map(e=>e.code)]}
}
export function validateEnvelope(payload){
 proof(payload&&typeof payload==='object'&&!Array.isArray(payload)&&payload.status===200,'Upstream status failure')
 for(const key of ['error','Error'])if(payload[key]!=null){const value=payload[key];proof(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>['message','body'].includes(k))&&Object.values(value).every(v=>v===''),'Upstream error')}
 for(const key of ['success','Success'])if(payload[key]!=null)proof(payload[key]===true,'Upstream failure')
 for(const key of ['errors','Errors','message','Message','exception','Exception','errorMessage','ErrorMessage'])if(payload[key]!=null)proof(payload[key]===''||(Array.isArray(payload[key])&&payload[key].length===0),'Upstream error field')
 for(const key of ['statusCode','StatusCode','code','Code','Status'])if(payload[key]!=null)proof(payload[key]===200,'Conflicting upstream status')
 if(payload.metadata!=null){proof(typeof payload.metadata==='object'&&!Array.isArray(payload.metadata),'Malformed native metadata');if(Object.hasOwn(payload.metadata,'isFallback'))proof(payload.metadata.isFallback===false,'Fallback inventory unavailable')}
 proof(payload.data&&typeof payload.data==='object'&&!Array.isArray(payload.data),'Missing native data')
 return {data:payload.data,metadata:payload.metadata??null}
}
export function validateBoard(html){
 proof(activeHead(html).titles.join('|')==='Careers at Boston Scientific','Native board title mismatch')
 const scripts=activeScripts(html).filter(s=>s.includes('_EF_GROUP_ID'))
 proof(scripts.length===1&&/^\s*window\._EF_GROUP_ID\s*=\s*"bostonscientific\.com";\s*$/.test(scripts[0]),'Native company domain mismatch')
}
export function validateRow(row,{now=new Date().toISOString()}={}){
 proof(row&&typeof row==='object'&&!Array.isArray(row)&&Number.isSafeInteger(row.id)&&row.id>0,'Malformed native ID')
 proof(typeof row.name==='string'&&row.name.trim()&&typeof row.displayJobId==='string'&&/^\d+$/.test(row.displayJobId)&&row.atsJobId===row.displayJobId,'Native requisition/title mismatch')
 proof(row.positionUrl===`/careers/job/${row.id}`,'Native public URL identity mismatch')
 for(const key of ['postedTs','creationTs'])proof(typeof row[key]==='number'&&Number.isSafeInteger(row[key])&&row[key]>0&&row[key]*1000<=Date.parse(now),'Invalid/future native date')
 proof(Array.isArray(row.locations)&&row.locations.length>0&&Array.isArray(row.standardizedLocations)&&row.locations.length===row.standardizedLocations.length,'Native location arrays unavailable')
 const india=[];const countries=[]
 for(let i=0;i<row.locations.length;i++){
  const standard=row.standardizedLocations[i],raw=rawLocation(row.locations[i],standard);proof(typeof standard==='string'&&standard.trim(),'Malformed standardized location')
  let standardCountry,standardCity
  if(standard.includes('|')){proof(standard===row.locations[i],'Uncorroborated structured location');standardCountry=raw.primary;standardCity=raw.primaryCity}
  else{const pieces=standard.split(',').map(s=>s.trim());standardCountry=country(pieces.at(-1));standardCity=city(pieces[0]);proof(standardCountry,'Unknown standardized country')}
  proof(standardCountry===raw.primary,'Native country contradiction')
  if(raw.primary==='IN'){proof(standardCity===raw.primaryCity&&standardCity!=='in'&&standardCity!=='india','India city contradiction');india.push({location:row.locations[i].split('|')[0].trim(),city:row.locations[i].split(',')[0].replace(/\s+IN-[A-Z0-9]+$/,'').trim()})}
  for(const e of raw.extra)if(e.code==='IN')proof(raw.primary==='IN'&&e.city===raw.primaryCity,'Secondary India requires independently corroborated full location')
  countries.push(...raw.codes)
 }
 for(const key of ['country','countryCode','country_code'])if(row[key]!=null)proof(typeof row[key]==='string'&&country(row[key])&&countries.every(c=>c===country(row[key])),'Explicit country field contradiction')
 return{india:india.length>0,indiaLocations:india,countries:[...new Set(countries)]}
}
export function validateDetail(payload,listing,options={}){
 const data=validateEnvelope(payload).data,scope=validateRow(data,options)
 for(const key of ['id','displayJobId','atsJobId','name','postedTs','creationTs','positionUrl'])proof(data[key]===listing[key],'Native detail '+key+' mismatch')
 for(const key of ['locations','standardizedLocations'])proof(JSON.stringify(data[key])===JSON.stringify(listing[key]),'Native detail location mismatch')
 proof(data.publicUrl===ORIGIN+listing.positionUrl,'Native public apply origin/identity mismatch')
 proof(data.positionUserActions?.applyAction?.status==='allowed','Native application is not allowed')
 proof(typeof data.jobDescription==='string','Missing native description field')
 const jobDescription=extractActiveDescription(data.jobDescription)
 return{...data,jobDescription,sourceDetailComplete:Boolean(jobDescription),scope}
}
