import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dgram from 'node:dgram'
import { syncBuiltinESMExports } from 'node:module'

const deny = () => { throw new Error('Public network is disabled for scraper regression verification') }
globalThis.fetch = async () => deny()
http.request = http.get = https.request = https.get = deny
http2.connect = net.connect = net.createConnection = tls.connect = dgram.createSocket = deny
syncBuiltinESMExports()
