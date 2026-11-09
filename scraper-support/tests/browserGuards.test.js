import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isBlockedInternalUrl,
  isInternalIpAddress,
  isPrivateIPv4,
} from '../utils/browser.js'

test('isPrivateIPv4 identifies common internal IPv4 ranges', () => {
  assert.equal(isPrivateIPv4('127.0.0.1'), true)
  assert.equal(isPrivateIPv4('10.0.0.8'), true)
  assert.equal(isPrivateIPv4('172.20.4.10'), true)
  assert.equal(isPrivateIPv4('192.168.1.5'), true)
  assert.equal(isPrivateIPv4('8.8.8.8'), false)
})

test('isInternalIpAddress identifies internal IPv6 ranges and mapped loopback', () => {
  assert.equal(isInternalIpAddress('::1'), true)
  assert.equal(isInternalIpAddress('fe80::1'), true)
  assert.equal(isInternalIpAddress('fd12:3456:789a::1'), true)
  assert.equal(isInternalIpAddress('::ffff:127.0.0.1'), true)
  assert.equal(isInternalIpAddress('::ffff:169.254.169.254'), true)
  assert.equal(isInternalIpAddress('2606:4700:4700::1111'), false)
})

test('isBlockedInternalUrl blocks literal internal URLs', async () => {
  assert.equal(await isBlockedInternalUrl('http://127.0.0.1/admin'), true)
  assert.equal(await isBlockedInternalUrl('http://[::1]/'), true)
  assert.equal(await isBlockedInternalUrl('file:///etc/passwd'), true)
})

test('isBlockedInternalUrl blocks public hostnames that resolve to internal addresses', async () => {
  const resolveToPrivate = async () => ['169.254.169.254', '::ffff:169.254.169.254']

  assert.equal(
    await isBlockedInternalUrl('https://careers.example.test/jobs', resolveToPrivate),
    true,
  )
})

test('isBlockedInternalUrl allows public hostnames that resolve to public addresses', async () => {
  const resolveToPublic = async () => ['93.184.216.34']

  assert.equal(
    await isBlockedInternalUrl('https://careers.example.test/jobs', resolveToPublic),
    false,
  )
})
