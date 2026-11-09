import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const attributes=node=>Object.fromEntries(Object.entries(node.attrs).sort())
const nodeAt=(tree,path)=>path.reduce((node,index)=>node?.children?.[index],tree)
const marker=email=>'reviewed-cloudflare-email-identity:'+email

// Exact parsed DOM, including whitespace text, raw script/style/noscript bodies,
// attributes, order and inert branches. The unchanged parser omits comments and
// declarations and decodes attribute entities; there is no text normalization.
export function readTenableRawPublisherDom(html){
  const root=readNativeDocument(html).nodes(node=>node.tag==='root')[0]
  const copy=node=>typeof node==='string'?node:{tag:node.tag,attributes:attributes(node),inert:node.inert===true,
    raw:node.raw??null,children:node.children.map(copy)}
  return copy(root)
}

export function captureTenablePublisherDom(html,url,policy,decoder){
  const rawTree=readTenableRawPublisherDom(html),signatureTree=structuredClone(rawTree),normalizations=[],reasons=[]
  const page=policy.pages[url],fields=[]
  const visit=(node,path=[])=>{
    if(typeof node==='string')return
    for(const[key,value]of Object.entries(node.attributes))if(key==='data-cfemail'||key==='href'&&value.includes('/cdn-cgi/l/email-protection#'))fields.push({path,attribute:key})
    node.children.forEach((child,index)=>visit(child,[...path,index]))
  }
  visit(rawTree)
  const fail=reason=>{reasons.push(reason);return {rawTree,signatureTree:rawTree,normalizations:[],reasons,decoder}}
  if(!page||page.fields.length!==2||fields.length!==2||!equal(fields,page.fields.map(({path,attribute})=>({path,attribute}))))return fail('unreviewed-encoded-email-field-path-or-count')
  if(!decoder?.verified||!decoder.cohortVerified||decoder.url!==policy.decoder.url||decoder.programSha256!==policy.decoder.programSha256
    ||decoder.contentType!==policy.decoder.contentType)return fail('reviewed-email-decoder-or-activation-unavailable')
  for(const field of page.fields){
    const node=nodeAt(rawTree,field.path),encoded=node?.attributes?.[field.attribute]
    if(node?.tag!==field.tag||typeof encoded!=='string'||!encoded.startsWith(field.prefix))return fail('unreviewed-encoded-email-node-or-prefix')
    const others=Object.fromEntries(Object.entries(node.attributes).filter(([key])=>key!==field.attribute))
    if(!equal(others,field.otherAttributes))return fail('unreviewed-encoded-email-node-attributes')
    const hex=encoded.slice(field.prefix.length)
    if(hex.length!==2+Buffer.byteLength(policy.expectedEmail,'utf8')*2||!/^[0-9a-f]+$/.test(hex))return fail('malformed-bounded-email-hex')
    const raw=Buffer.from(hex,'hex'),decodedBytes=Buffer.from(raw.subarray(1).map(byte=>byte^raw[0]))
    let decodedEmail;try{decodedEmail=new TextDecoder('utf-8',{fatal:true}).decode(decodedBytes)}catch{return fail('invalid-email-utf8')}
    if(decodedEmail!==policy.expectedEmail)return fail('changed-decoded-contact-email')
    nodeAt(signatureTree,field.path).attributes[field.attribute]=marker(decodedEmail)
    normalizations.push({path:field.path,tag:field.tag,attribute:field.attribute,rawEncodedAttribute:encoded,
      decodedEmail,signatureValue:marker(decodedEmail),decoder:{url:decoder.url,programSha256:decoder.programSha256,contentType:decoder.contentType}})
  }
  for(const field of page.fields){
    const context=[];let node=signatureTree;context.push({tag:node.tag,attributes:node.attributes,inert:node.inert})
    for(const index of field.path.slice(0,-1)){node=node.children[index];context.push({tag:node.tag,attributes:node.attributes,inert:node.inert})}
    if(!equal(context,field.ancestorContext))return fail('unreviewed-encoded-email-ancestor-context')
  }
  return {rawTree,signatureTree,normalizations,reasons,decoder}
}
