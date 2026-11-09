import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const origin='https://tensorgo.com'
const mainUrl=origin+'/static/js/main.dd1b2abe.js'
const mainHash='a165b5c21362147cdc53a3aac49f8ecb35e178ceb4305355a089fc427208b2e1'
const hash=value=>createHash('sha256').update(value).digest('hex')
const requireContract=(condition)=>{if(!condition)throw Error('TensorGo current public job API handoff program contract changed')}
// Reviewed published webpack careers and role routes, including their shared
// dependencies. Module1473 enables the declared public API; module985 reads
// GET /api/jobs and /api/jobs/<slug>. Its bundled example roles are fallbacks,
// and never establish a live inventory. Module803 renders description in full.
const chunks=[
 ['375','54b22870','664eb2684de67b9f4616d384d45e1840396bcd30f77248ed83b43725b93bec1d'],
 ['756','6762a9d3','b34fabc8ef8410b18eed67e071a01a95270f304b298864829019b6ee2cb8a11e'],
 ['757','ea6a7b05','3135e7cd97bc76485fad02f6aac32ccf4be8eb8d3fe28f0bba995be859f871d7'],
 ['985','b6e52122','769dd0fad5baa365551c201f97f53eb2d1d9ed3d191a34780df2a8964339260b'],
 ['402','92f6cf5e','3977b66dec14f035c2ef6037a82f177135edf457376a8f68df6a31fd10154ea0'],
 ['803','76777e33','67630548509198f1bf7a0652a46c1e3fee10c1ae8254e879eb44b942d7d30d8d'],
]
export async function readReviewedTensorGoChunks({html,asset,bundle,readText}){
 requireContract(asset.href===mainUrl&&hash(bundle)===mainHash)
 const doc=readNativeDocument(html)
 const mains=doc.nodes(node=>node.tag==='script'&&node.attrs.src&&/\/static\/js\/main\.[^/]+\.js$/.test(node.attrs.src))
 requireContract(mains.length===1&&new URL(mains[0].attrs.src,origin).href===mainUrl)
 requireContract(bundle.includes('bn=pn(()=>Promise.all([n.e(375),n.e(756),n.e(757),n.e(985),n.e(402)]).then(n.bind(n,2402)))')
  &&bundle.includes('wn=pn(()=>Promise.all([n.e(985),n.e(803)]).then(n.bind(n,6803)))'))
 for(const[id,version,expectedHash]of chunks){
  requireContract(bundle.includes(`${id}:"${version}"`))
  const body=await readText(`${origin}/static/js/${id}.${version}.chunk.js`)
  requireContract(hash(body)===expectedHash)
 }
 return true
}
