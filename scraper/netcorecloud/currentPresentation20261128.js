import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

export const PRESENTATION_URL = 'https://careerpagenetcore.lovable.app/'
export const BOARD_SCRIPT_URL = 'https://netcoreai.mynexthire.com/employer/ui/js/jobboard/careers.js'
const GLOBALS_URL = 'https://netcoreai.mynexthire.com/employer/ui/js/wow/wow-global-classes.js'
const ENCODER_URL = 'https://netcoreai.mynexthire.com/employer/ui/js/wowjsons/encoder.js'
const ENTRY_URL = PRESENTATION_URL + 'assets/index-q-Djt2Ye.js'
const ROUTE_URL = PRESENTATION_URL + 'assets/routes-rr1TnxQN.js'
const STYLES_URL = PRESENTATION_URL + 'assets/styles-CiWsseNz.css'
const profiles = new Map([
  [ENTRY_URL, '8adc572c6d9674b8ff640903db7d2e0f9f5a8c4de470a2523130521d36f71be1'],
  [ROUTE_URL, '8cb7fcd7d6710f78ee0fbdec133b78898bae860dacc245f00a9cd953390149e3'],
  [STYLES_URL, 'bad7ceec98f7ab26dca1694cd2f057d9031d9fb28eda3d6cb8a544a987488c43'],
  [GLOBALS_URL, '7d66e8fca26bcdefb63acfff34c9ed457946ff85075d855bffee8821f56ebbec'],
  [ENCODER_URL, '41a1af4ee0a42cad855b9bcd2215bb7686e5cd9f9af3fc06dfbc1593b219aa27'],
  [BOARD_SCRIPT_URL, '19e078b0f0328cf36adce43b62e3db3dcf624b8630349c3c3ab8668955c0bbf4'],
])
const requireContract = (condition, message) => { if (!condition) throw new Error('Netcore ' + message) }
const categories = ['customer_success', 'engineering', 'marketing', 'others', 'product', 'sales']
const executable = node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && ['', 'module', 'text/javascript', 'application/javascript'].includes((node.attrs.type || '').toLowerCase())
const declared = (doc, url, base, predicate = executable) => doc.nodes(node => {
  if (!predicate(node)) return false
  try { return new URL(node.attrs.src || node.attrs.href, base).href === url } catch { return false }
}).length === 1
const checkedProgram = async (url, getPage) => {
  const body = await getPage(url)
  requireContract(createHash('sha256').update(body).digest('hex') === profiles.get(url), url === BOARD_SCRIPT_URL
    ? 'complete public inventory contract changed materially' : 'complete public client/program contract changed: ' + url)
  return body
}

// This finite SSR/main/lazy-route/CSS profile establishes six current category
// observations. It does not establish corporate delegation or a complete UI:
// telemetry, decorative embeds and other browser dependencies remain unqualified.
export const verifyCurrentPresentation = async (html, getPage) => {
  const doc = readNativeDocument(html), titles = doc.nodes(node => node.tag === 'title').map(node => node.raw || '')
  requireContract(titles.length === 1 && /^Careers at Netcore\b/.test(titles[0].trim()), 'verified careers presentation handoff changed materially')
  const sections = doc.nodes(node => node.tag === 'section' && node.attrs.id === 'roles')
  requireContract(sections.length === 1 && /Find Your Role/.test(doc.text(sections[0])), 'current presentation roles category handoff changed')
  const links = doc.nodes(node => node.tag === 'a' && /careers-list|job_category/.test(node.attrs.href || ''))
  const values = links.map(node => node.attrs.href).sort()
  requireContract(links.length === 6 && JSON.stringify(values) === JSON.stringify(categories.map(category => 'https://netcore.ai/careers-list?job_category=' + category).sort())
    && links.every(node => doc.nodes(candidate => candidate === node, sections[0]).length === 1), 'current presentation category handoff changed')
  requireContract(declared(doc, ENTRY_URL, PRESENTATION_URL, node => executable(node) && node.attrs.type === 'module')
    && declared(doc, STYLES_URL, PRESENTATION_URL, node => node.tag === 'link' && node.attrs.rel === 'stylesheet'), 'current presentation entry/styles handoff changed')
  const entry = await checkedProgram(ENTRY_URL, getPage)
  requireContract(entry.includes('component:ol(()=>Wu(()=>import(`./routes-rr1TnxQN.js`),[]),`component`)'), 'current presentation lazy route producer changed')
  const route = await checkedProgram(ROUTE_URL, getPage)
  requireContract(route.includes('wr=`https://netcore.ai/careers-list?job_category=`')
    && route.includes('href:`${wr}${e.slug}`') && route.includes('export{kr as component}')
    && categories.every(category => route.includes('slug:`' + category + '`')), 'current presentation category consumer changed')
  await checkedProgram(STYLES_URL, getPage)
  return 'current-20261128'
}

// Reviewed complete bodies bind the board origin -> netcoreai/prod/us1,
// public default context -> unfiltered list, and jd -> read-only detail POST.
// No downloaded code is executed; application/auth/activity consumers are unused.
export const verifyNativeReadPrograms = async (boardHtml, boardUrl, getPage) => {
  const board = readNativeDocument(boardHtml)
  requireContract([GLOBALS_URL, ENCODER_URL, BOARD_SCRIPT_URL].every(url => declared(board, url, boardUrl)), 'verified public careers board handoff unavailable')
  const globals = await checkedProgram(GLOBALS_URL, getPage)
  requireContract(globals.includes('mnhServer.employerShortName = (mnhServer.host.split("."))[0]')
    && globals.includes('mnhServer.protocol = "https://" + mnhServer.host'), 'native origin producer contract changed')
  const encoder = await checkedProgram(ENCODER_URL, getPage)
  requireContract(encoder.includes('encoderFactory.getQStringObject = function(cvSource, pageType, reqId)')
    && encoder.includes('qStringContext.requester.code = ""') && encoder.includes('qStringContext.bufilter = -1'), 'native public context producer contract changed')
  const client = await checkedProgram(BOARD_SCRIPT_URL, getPage)
  requireContract(client.includes('url: careersFactory.smaclifyUrl + "/careers/reqlist/get"')
    && client.includes('$scope.thePage.reqsListPageVars.reqList = response.data.reqDetailsBOList;')
    && client.includes('input.filterByBuId = $scope.basePage.basePageVars.qStringContext.bufilter;')
    && client.includes('pageType === "jd" ? careersFactory.getRequisitionV2(input)')
    && client.includes('url: `${baseUrl}/d17/careers/requisition/object`')
    && client.includes('let region = (inClientList).indexOf(csn) == -1 ? "us1" : "in1";'), 'complete public inventory contract changed materially')
}
