import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const ATS_ORIGIN='https://dassault-aviation-cand.talent-soft.com'
export const HANDOFF_URL='https://carriere.dassault-aviation.com/accueil.aspx?LCID=1036'
export const ENTRY_URL=ATS_ORIGIN+'//accueil.aspx?LCID=1036'
export const LISTING_URL=ATS_ORIGIN+'/offre-de-emploi/liste-toutes-offres.aspx?all=1&mode=list'
export const activeDocument = html => {
  const doc=document(html)
  const prune=(node,inherited=false)=>{
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs?.style||'')
    for(const child of node.children.filter(c=>typeof c!=='string'))prune(child,node.inactive)
  }
  prune(doc.root);return doc
}
const requireProof=(ok,reason)=>{if(!ok)throw Error(reason)}
const valuesFor=(doc,root,label)=>doc.nodes(n=>n.children.some(c=>typeof c!=='string'&&doc.text(c)===label),root).map(parent=>{
  const children=parent.children.filter(c=>typeof c!=='string'),index=children.findIndex(n=>doc.text(n)===label)
  return doc.text(children[index+1])
})
const dateISO=value=>{
  const m=value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if(!m)return null
  const iso=`${m[3]}-${m[2]}-${m[1]}`
  return Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().startsWith(iso)?iso:null
}
// Current Talentsoft India template. Every fact is bound to its own native
// listing ID/title and application action; the parent-board scope stays open.
export const qualifyCurrentIndiaDetail=(detail,row)=>{
  const proof=(ok,reason)=>requireProof(ok,'Native current India '+reason)
  proof(row&&/^\d+$/.test(row.id)&&new RegExp('^\\d{4}-'+row.id+'$').test(row.reference)
    &&new URL(row.sourceUrl).origin===ATS_ORIGIN&&new URL(row.sourceUrl).pathname.endsWith('_'+row.id+'.aspx'),'listing identity changed')
  proof(detail.nodes(n=>n.tag==='h1'&&detail.text(n)===row.title).length===1
    &&detail.text(detail.root).includes('Menu Site carrière Dassault Aviation'),'title/employer changed')
  const contents=detail.nodes(n=>n.attrs.id==='contenu-ficheoffre')
  proof(contents.length===1,'full authored content missing')
  const content=contents[0],referenceParents=detail.nodes(n=>n.children.some(c=>typeof c!=='string'&&c.tag==='h3'&&detail.text(c)==='Référence'),content)
  const refs=referenceParents.filter(n=>n.children.filter(c=>typeof c!=='string').length===1).map(n=>detail.text(n).replace(/^Référence\s+/,''))
  const locations=valuesFor(detail,content,'Localisation')
  proof(refs.length===1&&refs[0]===row.reference,'reference changed')
  const geography=locations.length===1?locations[0].split(',').map(v=>v.trim()):[]
  proof(geography.length===3&&geography[0]==='International'&&geography[1]==='Inde'&&geography[2],'explicit workplace country missing or contradictory')
  const workplace=valuesFor(detail,content,'Lieu de travail')
  proof(workplace.length===1&&workplace[0].toUpperCase()===geography[2].toUpperCase()+' - INDE','workplace fields disagree')
  for(const label of ['Missions proposées','Critères candidat','Profil requis'])proof(detail.nodes(n=>['h2','h3','h4'].includes(n.tag)&&detail.text(n)===label,content).length===1,'complete criteria section missing')
  const authored=detail.text(content),description=detail.outer(content)
  proof(authored.length>500&&authored.includes('Dassault Aviation')&&authored.includes('Dassault Reliance Aerospace Limited (DRAL)'), 'native role legal employer/full criteria changed')
  proof(detail.nodes(n=>['iframe','object','embed','img'].includes(n.tag),content).length===0,'nontext criteria require review')
  const forms=detail.nodes(n=>n.tag==='form'&&n.attrs.id==='aspnetForm')
  const apply=detail.nodes(n=>n.tag==='input'&&n.attrs.type==='submit'&&n.attrs.value==='Je postule à cette offre'&&detail.hasClass(n,'btnPostuler')&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true')
  proof(forms.length===1&&forms[0].attrs.method?.toLowerCase()==='post'
    &&new URL(forms[0].attrs.action,row.sourceUrl).href===row.sourceUrl&&apply.length>0,'own active application missing')
  return {source:'dassaultaviationindia',company:'Dassault Aviation India',title:row.title,jobId:row.id,requisitionId:row.reference,
    sourceUrl:row.sourceUrl,link:row.sourceUrl,applyUrl:row.sourceUrl,country:'India',city:geography[2],location:geography[2]+', India',
    postingDate:row.postingDate,sourceDescription:description,jobDescription:description,sourceDetailComplete:true,
    nativeListingRecord:row,nativeWorkplace:{countryLabel:geography[1],geography:locations[0],workplace:workplace[0]},
    nativeEmployerName:'Dassault Aviation / Dassault Reliance Aerospace Limited (DRAL)',
    nativeApplication:{method:'post',action:row.sourceUrl,submitNames:apply.map(n=>n.attrs.name)},applicationVisited:false,
    sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyDomain:'dassault-aviation.com',atsPlatform:'talentsoft'}
}
export const collectNative=async({read,official,signal})=>{
  requireProof(official.nodes(n=>n.tag==='a'&&n.attrs.href===HANDOFF_URL&&official.text(n)==='Join us').length>0,'Corporate active Talentsoft handoff missing')
  // Resolve the corporate vanity host afresh; only its captured native Talentsoft
  // destination is accepted by the caller's bounded redirect reader.
  const entry=await read(HANDOFF_URL,{allowedFinalUrl:ENTRY_URL})
  requireProof(entry.nodes(n=>n.tag==='h1'&&entry.text(n)==="Bienvenue sur le site d'emploi Dassault Aviation").length===1,'Native employer identity changed')
  requireProof(entry.nodes(n=>n.tag==='a'&&n.attrs.href==='/offre-de-emploi/liste-toutes-offres.aspx?all=1&mode=list#ancrecontenu'&&entry.text(n)==='Voir toutes les offres').length>0,'Native all-jobs delegation missing')
  const corporatePublicDates=new Map()
  for(const card of official.nodes(n=>official.hasClass(n,'card--job'))){
    const m=official.text(card).match(/Ref\. : (\d{4}-\d+) - (\d{2})\.(\d{2})\.(\d{4})/)
    if(m)corporatePublicDates.set(m[1],`${m[4]}-${m[3]}-${m[2]}`)
  }
  const rows=[],seenIds=new Set(),seenPages=new Set(),queue=[LISTING_URL]
  let total
  while(queue.length){
    const url=queue.shift();if(seenPages.has(url))continue
    requireProof(seenPages.size<100,'Native pagination exceeds reviewed bound');seenPages.add(url)
    const doc=await read(url)
    requireProof(doc.text(doc.root).includes('Menu Site carrière Dassault Aviation'),'Native listing employer identity missing')
    const totals=doc.nodes(n=>doc.hasClass(n,'ts-ol-pagination__title')).map(n=>doc.text(n).match(/^Nombre de résultats : (\d+) offre\(s\)$/)?.[1])
    requireProof(totals.length===2&&totals.every(t=>t!==undefined&&t===totals[0]),'Native result totals missing or contradictory')
    const pageTotal=Number(totals[0]);requireProof(pageTotal>0&&pageTotal<=1000&&(total===undefined||total===pageTotal),'Native result total changed or out of bound');total=pageTotal
    const cards=doc.nodes(n=>doc.hasClass(n,'ts-offer-list-item'))
    requireProof(cards.length>0&&cards.length<=10,'Native page has missing or excessive cards')
    for(const card of cards){
      const links=doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'ts-offer-list-item__title-link'),card)
      requireProof(links.length===1,'Native card stable role link missing')
      const role=new URL(links[0].attrs.href,ATS_ORIGIN),id=role.pathname.match(/^\/offre-de-emploi\/emploi-[a-z0-9-]+_(\d+)\.aspx$/)?.[1]
      const favorites=doc.nodes(n=>n.attrs['data-reference'],card)
      requireProof(role.origin===ATS_ORIGIN&&!role.search&&id&&!seenIds.has(id)&&favorites.length===1,'Native role ID missing, duplicate or cross-origin')
      const reference=favorites[0].attrs['data-reference'],title=doc.text(links[0])
      requireProof(new RegExp('^\\d{4}-'+id+'$').test(reference)&&favorites[0].attrs['data-title']?.replace(/\s+/g,' ').trim()===title,'Native requisition identity changed')
      const info=doc.nodes(n=>doc.hasClass(n,'ts-offer-list-item__description'),card)
      requireProof(info.length===1,'Native role listing fields missing')
      const fields=doc.nodes(n=>n.tag==='li',info[0]).map(n=>doc.text(n)),postingDate=dateISO(fields[1])
      requireProof(fields.length===4&&fields[0]==='Réf. : '+reference&&postingDate,'Native public date or listing fields changed')
      const corporateDate=corporatePublicDates.get(reference)||null
      seenIds.add(id);rows.push({id,reference,title,sourceUrl:role.href,nativeListingPublicationDate:postingDate,
        nativeCorporatePublicationDate:corporateDate,postingDate:corporateDate&&corporateDate<postingDate?corporateDate:postingDate})
    }
    for(const link of doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
      const target=new URL(link.attrs.href,ATS_ORIGIN)
      if(target.origin===ATS_ORIGIN&&target.pathname==='/offre-de-emploi/liste-toutes-offres.aspx'&&target.searchParams.has('page')){
        requireProof(/^\d+$/.test(target.searchParams.get('page'))&&Number(target.searchParams.get('page'))>=1&&Number(target.searchParams.get('page'))<=Math.ceil(total/10)
          &&target.searchParams.get('LCID')==='1036'&&(!target.searchParams.has('showSearchUrl')||target.searchParams.get('showSearchUrl')==='1')
          &&[...target.searchParams.keys()].every(k=>['page','LCID','showSearchUrl'].includes(k)),'Native pagination scope changed')
        target.hash='';target.searchParams.delete('showSearchUrl');const next=target.searchParams.get('page')==='1'?LISTING_URL:target.href
        if(!seenPages.has(next)&&!queue.includes(next))queue.push(next)
      }
    }
  }
  requireProof(rows.length===total&&seenPages.size===Math.ceil(total/10),'Native unique inventory does not reconcile to total/pages')
  const exclusions=[],jobs=[],unresolved=[]
  for(const [index,row] of rows.entries()){
    let detail,reading=true
    try{
    detail=await read(row.sourceUrl);reading=false
    requireProof(detail.nodes(n=>n.tag==='h1'&&detail.text(n)===row.title).length===1,'Native detail title changed')
    requireProof(detail.text(detail.root).includes('Menu Site carrière Dassault Aviation'),'Native detail employer identity missing')
    const content=detail.nodes(n=>n.attrs.id==='contenu-ficheoffre')
    requireProof(content.length===1,'Native detail authoritative fields unavailable')
    if(valuesFor(detail,content[0],'Référence').length){
      const locations=valuesFor(detail,content[0],'Localisation'),geography=locations.length===1?locations[0].split(',').map(v=>v.trim()):[]
      if(geography.length!==3||geography[0]!=='International'||geography[1]!=='Inde'){
        unresolved.push({...row,country:null,nativeLocations:locations,nativeDetailHTML:detail.outer(content[0]),reason:'modern native workplace country unqualified; full record retained'})
        continue
      }
      const job=qualifyCurrentIndiaDetail(detail,row)
      reading=true;const closingDetail=await read(row.sourceUrl);reading=false
      const closing=qualifyCurrentIndiaDetail(closingDetail,row)
      requireProof(JSON.stringify(job)===JSON.stringify(closing),'Native current India closing role criteria/application changed')
      job.nativeOwnRoleClosingVerified=true
      jobs.push(job);continue
    }
    const refs=valuesFor(detail,content[0],"Référence de l'offre")
    requireProof(refs.length===1&&refs[0]===row.reference,'Native detail requisition identity changed')
    const locations=valuesFor(detail,content[0],'Localisation')
    // Talentsoft publishes either a France country/region path or an
    // International/country/city path. USA is an explicit country value, not
    // an inference from Little Rock or from the role's marketing prose.
    const geography=locations.length===1?locations[0].split(',').map(value=>value.trim()):[]
    const primaryCountry=geography[0]==='France'?'France':geography[0]==='International'&&geography[1]==='USA'?'United States':null
    requireProof(primaryCountry,'Native primary country changed or incomplete; employer, India and secondary-scope review required')
    const locationLabels=detail.nodes(n=>n.tag==='div'&&/font-weight:\s*bold/.test(n.attrs.style||'')&&detail.text(n)&&n.children.every(c=>typeof c==='string'),content[0]).map(n=>detail.text(n))
    requireProof(locationLabels.filter(v=>/localis|pays|country|location|geograph/i.test(v)).every(v=>v==='Localisation'),'Unreviewed native secondary geography field')
    const apply=detail.nodes(n=>n.tag==='input'&&n.attrs.type==='submit'&&n.attrs.value==='Je postule à cette offre'&&detail.hasClass(n,'btnPostuler')&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true')
    requireProof(apply.length>0&&detail.nodes(n=>n.tag==='form'&&n.attrs.id==='aspnetForm'&&new URL(n.attrs.action,row.sourceUrl).href===row.sourceUrl).length===1,'Native active role application missing')
    // These records are excluded by their explicit country. Their visible
    // marketing prose is never promoted to an India role or description.
    const prose=detail.text(content[0])
    const mentions=prose.match(/.{0,120}\b(?:Inde|India|Egypte|Égypte|Egypt)\b.{0,160}/gi)||[]
    const indiaMention=/\b(?:Inde|India)\b/i.test(prose)
    const currentIndiaClaim=/\b(?:poste|emploi|stage|position|role|rôle)\s+(?:(?:actuellement|currently)\s+)?(?:en|in)\s+(?:Inde|India)\b|\b(?:poste|emploi|stage|position|role|rôle)\s+(?:est\s+|is\s+)?(?:basé[es]?|situé[es]?|localisé[es]?|based|located)\s+(?:en|in)\s+(?:Inde|India)\b/i.test(prose)
    requireProof(!currentIndiaClaim,'Native current India claim conflicts with explicit non-India primary geography')
    exclusions.push({...row,nativeLocations:locations,country:primaryCountry,nativeSecondaryCountryMentions:mentions,
      countryScopeComplete:!indiaMention,reason:indiaMention?primaryCountry+'-primary-India-secondary-scope-unresolved':'explicit-native-primary-country-outside-India'})
    }catch(error){
      signal?.throwIfAborted()
      unresolved.push({...row,country:null,nativeDetailHTML:detail?detail.outer(detail.root):null,reason:error?.message||'native detail unresolved'})
      if(reading){
        for(const remaining of rows.slice(index+1))unresolved.push({...remaining,country:null,reason:'native detail not fetched after transport or offline capture boundary hold'})
        break
      }
    }
  }
  if(unresolved.length&&!jobs.length)throw Error(unresolved[0].reason)
  return {jobs,nativeBoardComplete:true,nativePublicJobCount:total,nativePrimaryIndiaJobCount:jobs.length,nativeIndiaJobCount:null,
    nativeDetailScopeComplete:unresolved.length===0,nativeSecondaryCountryScopeComplete:false,nativePagesFetched:seenPages.size,exclusions,unresolved}
}
