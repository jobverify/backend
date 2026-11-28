import {createHash} from 'node:crypto'
import {isDeepStrictEqual as equal} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

export const currentPrimaryDependency={url:'https://genworx.ai/assets/features-Bm6nNtIc.js',bytes:39507,sha256:'c2029acf852c31d994f8635559522caebe6d095a0a65c233f73fc8d64d1d80c6'}
const sha=value=>createHash('sha256').update(value).digest('hex')

export function reviewedCurrentGenworxPrimary(home,revisions){
 const matches=body=>revisions.filter(revision=>Buffer.byteLength(body)===revision.primary.bytes&&sha(body)===revision.primary.sha256)
 const original=matches(home.text)
 if(original.length)return original
 // Only the two captured social-card images changed. Read their actual active
 // meta nodes, restore exactly v4 to v3 at those source ranges, and require the
 // entire remaining document to equal an existing reviewed deployment. No
 // executable, navigation, employer, stylesheet or other metadata is masked.
 const doc=readNativeDocument(home.text,{sourceRanges:true}),current='https://genworx.ai/og-image-v4.jpg',reviewed='https://genworx.ai/og-image-v3.jpg',changes=[]
 for(const [attribute,value]of [['property','og:image'],['name','twitter:image']]){
  const nodes=doc.nodes(node=>node.tag==='meta'&&node.attrs[attribute]===value)
  if(nodes.length!==1||!equal(nodes[0].attrs,{[attribute]:value,content:current}))return []
  const node=nodes[0],tag=home.text.slice(node.sourceStart,node.sourceOpenEnd)
  if(tag.split(current).length!==2)return []
  changes.push({start:node.sourceStart,end:node.sourceOpenEnd,value:tag.replace(current,reviewed)})
 }
 let normalized=home.text
 for(const change of changes.sort((a,b)=>b.start-a.start))normalized=normalized.slice(0,change.start)+change.value+normalized.slice(change.end)
 return matches(normalized).map(revision=>({...revision,clientDependencies:[currentPrimaryDependency]}))
}
