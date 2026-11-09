import {clientScriptDeclarations,hasClientDocumentBase} from '../../utils/reviewedClientProgram.js'
import {createHash} from 'node:crypto'

// Only explicitly opted-in declarations gain additional reviewed deployments.
// Each alternative binds its exact absolute URL, declared specifier and complete
// original entity digest. Downloaded programs remain data and are never run.
const reviewedProfiles = profile => {
  const declaration=profile?.declaration
  if(declaration?.kind!=='active-declared-external-profile'
    || !Array.isArray(declaration.reviewedAlternates)
    || !declaration.reviewedAlternates.length || declaration.reviewedAlternates.length>3)return[]
  const profiles=[declaration,...declaration.reviewedAlternates],urls=new Set()
  try{
    for(const entry of profiles){
      if(!entry||typeof entry.scriptURL!=='string'||typeof entry.scriptSpecifier!=='string'
        || !entry.scriptSpecifier || !/^[a-f0-9]{64}$/i.test(entry.scriptSHA256??''))return[]
      const url=new URL(entry.scriptURL),resolved=new URL(entry.scriptSpecifier,profile.primaryURL)
      if(url.protocol!=='https:'||url.username||url.password||url.hash||url.href!==entry.scriptURL
        || resolved.href!==url.href||urls.has(url.href))return[]
      urls.add(url.href)
    }
  }catch{return[]}
  return profiles
}

export const reviewedDeclaredAssetURLs = profile => reviewedProfiles(profile).map(entry=>entry.scriptURL)

export const selectReviewedDeclaredAsset = (html,profile) => {
  if(hasClientDocumentBase(html))return null
  const profiles=reviewedProfiles(profile)
  if(!profiles.length)return null
  const byURL=new Map(profiles.map(entry=>[entry.scriptURL,entry])),selected=[]
  for(const node of clientScriptDeclarations(html)){
    if(typeof node.attrs.src!=='string')continue
    try{
      const url=new URL(node.attrs.src,profile.primaryURL)
      const entry=byURL.get(url.href)
      if(entry)selected.push({...entry,scriptIntegrity:node.attrs.integrity??''})
    }catch{}
  }
  return selected.length===1?selected[0]:null
}

// Check the selected element's authored SRI against original entity bytes as
// well as the independent configured SHA-256 pin. Of recognized metadata,
// only the strongest algorithm participates; any matching digest at that
// strength qualifies. Unknown algorithms add no integrity restriction.
export const matchesAuthoredIntegrity = (declaration,bodyBase64) => {
  const metadata=declaration?.scriptIntegrity??''
  if(typeof metadata!=='string')return false
  const ranks=new Map([['sha256',1],['sha384',2],['sha512',3]])
  let algorithm=null,rank=0,expected=[]
  for(const token of metadata.split(/[\t\n\f\r ]+/).filter(Boolean)){
    const expression=token.split('?')[0],dash=expression.indexOf('-')
    const name=(dash<0?expression:expression.slice(0,dash)).toLowerCase(),strength=ranks.get(name)
    if(!strength||strength<rank)continue
    const value=dash<0?'':expression.slice(dash+1)
    if(strength>rank){algorithm=name;rank=strength;expected=[]}
    expected.push(value)
  }
  if(!algorithm)return true
  if(typeof bodyBase64!=='string')return false
  const actual=createHash(algorithm).update(Buffer.from(bodyBase64,'base64')).digest('base64')
  return expected.includes(actual)
}
