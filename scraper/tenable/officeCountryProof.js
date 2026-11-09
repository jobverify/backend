import {createHash} from 'node:crypto'
import {validatePublicPostingScope} from '../../scraper-support/utils/publishingGapAts.js'
import {greenhouseCountryLabels,greenhouseLocationLabels,hasUnhandledGreenhouseGeography} from '../../scraper-support/utils/greenhouseLocations.js'
import {isGreenhouseProspectPost} from '../../scraper-support/utils/greenhouseProspects.js'

const clean=value=>typeof value==='string'?value.trim():''
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value
const sha=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const fail=message=>{throw new Error('Tenable current office country proof: '+message)}
const validId=id=>Number.isSafeInteger(id)&&id>0
const names=new Map(),display=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b),canonical=new Intl.Locale('und-'+code).region,name=display.of(code)
  if(!name||['ZZ','EU','UN','XA','XB','QO','EZ'].includes(code))continue
  names.set(code.toLowerCase(),canonical)
  // Deprecated aliases (FX -> FR, UK -> GB) must not overwrite the canonical
  // country-name entry when Intl gives both aliases the same display name.
  if(canonical===code)names.set(name.toLowerCase(),canonical)
}
for(const[label,code]of Object.entries({USA:'US','United States of America':'US',UK:'GB','United Kingdom':'GB',GBR:'GB',CAN:'CA',AUS:'AU',SGP:'SG',IND:'IN'}))names.set(label.toLowerCase(),code)
const definition=office=>({id:office.id,name:office.name,location:office.location,child_ids:office.child_ids,parent_id:office.parent_id})
const key=value=>JSON.stringify(stable(value))

// Supplemental facts are derived solely from current explicit native IDs and
// country labels. The original complete GH payload still goes to the strongest
// runtime unchanged. No office address/city/HQ label supplies a country here.
export function auditTenableOfficeCountries(payload,records,provider,config,rendererProof){
  if(!payload||Object.keys(payload).join(',')!=='offices'||!Array.isArray(payload.offices))fail('invalid office envelope')
  const byId=new Map(),reasons=[],proofs=[],scope={byId:new Map(),proofs:[]}
  for(const office of payload.offices){
    const noOffice=office?.id===0&&office.name==='No Office'&&office.location===null&&office.parent_id===null&&Array.isArray(office.child_ids)&&office.child_ids.length===0
    if(!office||!(validId(office.id)||noOffice)||byId.has(office.id)||!clean(office.name)||(office.location!==null&&typeof office.location!=='string')
      ||!Array.isArray(office.child_ids)||office.child_ids.some(id=>!validId(id))||new Set(office.child_ids).size!==office.child_ids.length
      ||office.parent_id!==null&&!validId(office.parent_id)||!Array.isArray(office.departments))fail('invalid or duplicate office definition')
    byId.set(office.id,office)
  }
  const country=value=>names.get(clean(value).toLowerCase())||(clean(value)===rendererProof.countryAlias.nativeLabel?rendererProof.countryAlias.countryCode:null)
  const namedCountry=value=>{
    const label=clean(value),prefix=label.split(' - ')[0]
    // Free-text two-letter state prefixes such as MD/MA are not country codes.
    if(prefix.length===2&&!['US','UK'].includes(prefix.toUpperCase()))return null
    return country(label)||country(prefix)
  }
  const chainFor=id=>{
    const chain=[],seen=new Set();let office=byId.get(id)
    while(office){if(seen.has(office.id))fail('office parent cycle');seen.add(office.id);chain.push(office)
      if(office.parent_id===null)break
      const parent=byId.get(office.parent_id)
      if(!parent||!parent.child_ids.includes(office.id))fail('missing or nonreciprocal parent-country relationship')
      office=parent
    }
    return chain
  }
  for(const office of byId.values()){
    chainFor(office.id)
    for(const childId of office.child_ids){if(!byId.has(childId)||!chainFor(childId).slice(1).some(parent=>parent.id===office.id))fail('child-country edge is not a real descendant')}
  }
  const actualDefinitions=payload.offices.map(({id,name,location,parent_id,child_ids})=>({id,name,location,parent_id,child_ids})).sort((a,b)=>a.id-b.id)
  // New/renamed/reparented branches remain unknown until reviewed, even when
  // they do not happen to carry one of today's vacancies.
  if(sha(actualDefinitions)!==config.officeDefinitionSha256)reasons.push('unreviewed-office-definitions-or-branches')
  const allJobs=new Map(),memberships=new Map()
  for(const office of payload.offices)for(const department of office.departments){
    if(!department||!Array.isArray(department.jobs))fail('invalid office department jobs')
    for(const job of department.jobs){
      if(!validId(job?.id))fail('invalid nested native role identity')
      const native=records.find(row=>row.id===job.id)
      if(!native||isGreenhouseProspectPost(native))reasons.push('office-vacancy-inventory-disagrees:'+job.id)
      if(native&&Object.keys(job).some(field=>key({value:job[field]})!==key({value:native[field]})))reasons.push('office-native-role-metadata-disagrees:'+job.id)
      if(allJobs.has(job.id)&&key(allJobs.get(job.id))!==key(job))reasons.push('conflicting-nested-office-role:'+job.id)
      allJobs.set(job.id,job);if(!memberships.has(job.id))memberships.set(job.id,new Set());memberships.get(job.id).add(office.id)
    }
  }
  const vacancies=records.filter(row=>!isGreenhouseProspectPost(row)&&row.isListed!==false)
  if(!same([...allJobs.keys()].sort(),vacancies.map(row=>row.id).sort()))reasons.push('office-and-full-vacancy-cohorts-disagree')
  for(const row of vacancies){
    const countryLabels=greenhouseCountryLabels(row),declared=countryLabels.map(country)
    const roleProof={jobId:String(row.id),rawCountryLabels:countryLabels,countries:declared,offices:[],reasons:[]}
    const reviewedGeography=config.reviewedRoleGeography[String(row.id)]
    const currentGeography={nativeLocationLabels:greenhouseLocationLabels(row),nativeCountryLabels:countryLabels,
      officeIds:row.offices.map(office=>office.id),criteriaSha256:createHash('sha256').update(row.content).digest('hex')}
    roleProof.reviewedGeography=reviewedGeography||null;roleProof.currentGeography=currentGeography
    // The reciprocal hierarchy supplements a known current role allocation.
    // It cannot license arbitrary new worksite text or a newly changed JD.
    if(!reviewedGeography||key(reviewedGeography)!==key(currentGeography))roleProof.reasons.push('unreviewed-role-country-location-or-criteria-contract')
    if(!countryLabels.length||declared.some(code=>!code))roleProof.reasons.push('unresolved-native-country-label')
    if(declared.length!==1)roleProof.reasons.push('multi-country-role-allocation-unreviewed')
    if(hasUnhandledGreenhouseGeography(row))roleProof.reasons.push('unreviewed-native-geography-fields')
    for(const label of greenhouseLocationLabels(row)){
      if(/\b(?:worldwide|global|anywhere|any\s+location|all\s+locations|APAC|EMEA|AMER|LATAM|Asia[- ]Pacific)\b/i.test(label))roleProof.reasons.push('unresolved-broad-native-location')
      const explicit=namedCountry(label)
      if(explicit&&!declared.includes(explicit))roleProof.reasons.push('contradictory-explicit-native-location-country')
    }
    if(!Array.isArray(row.offices)||!row.offices.length)roleProof.reasons.push('missing-native-office-assignment')
    for(const assigned of row.offices||[]){
      const office=byId.get(assigned.id)
      if(!office||key(definition(assigned))!==key(definition(office))){roleProof.reasons.push('assigned-office-definition-conflict');continue}
      const chain=chainFor(office.id),parents=chain.slice(1).map(node=>({node,code:country(node.name)})).filter(item=>item.code)
      const countryNodes=parents.length?parents:chain.map(node=>({node,code:namedCountry(node.name)})).filter(item=>item.code)
      const countries=[...new Set(countryNodes.map(item=>item.code))]
      if(countries.length!==1){roleProof.reasons.push('unresolved-or-contradictory-explicit-office-country');continue}
      const code=countries[0]
      if(!declared.includes(code))roleProof.reasons.push('office-and-native-role-country-conflict')
      if(!memberships.get(row.id)?.has(office.id))roleProof.reasons.push('role-not-listed-under-assigned-current-office')
      const proof={officeId:office.id,officeName:office.name,country:code,boardToken:config.boardToken,region:'global',
        method:'same-board-current-office-id-and-explicit-parent-country',
        chain:chain.map(node=>({id:node.id,name:node.name,parent_id:node.parent_id,child_ids:node.child_ids})),
        explicitCountryNodeIds:countryNodes.map(item=>item.node.id),references:[{jobId:String(row.id),nativeOfficeId:assigned.id}]}
      proof.sha256=sha(proof);roleProof.offices.push(proof)
      const sharedDefinition=JSON.stringify({id:office.id,name:clean(office.name),location:office.location,child_ids:[],parent_id:office.parent_id})
      if(office.child_ids.length)roleProof.reasons.push('assigned-office-is-not-a-reviewed-leaf')
      scope.byId.set(office.id,{definition:sharedDefinition,region:'global',country:code,location:office.name,proof})
      scope.proofs.push(proof)
    }
    const nativeReasons=validatePublicPostingScope([row],'greenhouse',provider,{officeCountryScope:scope})
    const aliasOnly=countryLabels.length===1&&countryLabels[0]===rendererProof.countryAlias.nativeLabel
      &&declared[0]===rendererProof.countryAlias.countryCode&&roleProof.offices.length>0
      &&roleProof.offices.every(office=>office.country===declared[0])
      &&roleProof.reasons.length===0
      &&nativeReasons.length===1&&nativeReasons[0]==='native-location-scope-unresolved'
    const allocationComplete=declared.length===1&&Boolean(declared[0])&&roleProof.reasons.length===0
      &&roleProof.offices.length===row.offices.length&&roleProof.offices.length>0
      &&roleProof.offices.every(office=>office.country===declared[0])
    const hierarchyClosesNativeCountry=allocationComplete&&nativeReasons.length===1&&nativeReasons[0]==='native-location-scope-unresolved'
    if(nativeReasons.length&&!aliasOnly&&!hierarchyClosesNativeCountry)roleProof.reasons.push(...nativeReasons)
    if(hierarchyClosesNativeCountry)roleProof.supplementalNativeScopeProof={nativeReasons,
      method:'every-current-role-office-has-reciprocal-explicit-country-ancestry-matching-sole-native-country-and-all-labels-audited',
      nativeCountryLabels:countryLabels,officeIds:row.offices.map(office=>office.id),allNativeLocationLabels:greenhouseLocationLabels(row)}
    if(aliasOnly)roleProof.countryAliasProof={...rendererProof.countryAlias,rendererUrl:rendererProof.url,rendererSha256:rendererProof.sha256,
      rawCountryLabel:countryLabels[0],nativeRecordSha256:sha(row),method:'current-publisher-ISO-name-code-pair-original-native-value-retained'}
    roleProof.reasons=[...new Set(roleProof.reasons)]
    reasons.push(...roleProof.reasons.map(reason=>reason+':'+row.id));proofs.push(roleProof)
  }
  return {proofs,reasons:[...new Set(reasons)],officeCount:payload.offices.length,officeVacancyIds:[...allJobs.keys()].map(String).sort(),
    originalNativeCountryValuesPreserved:true}
}
