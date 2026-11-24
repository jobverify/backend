"""Bounded official employer icon lookup. Unknown brands use an initials tile."""
import asyncio
import hashlib
from html.parser import HTMLParser
import ipaddress
from io import BytesIO
import re
from urllib.parse import urljoin, urlsplit
import warnings

import aiohttp
from PIL import Image

MAX_LOGO_BYTES = 1024 * 1024
MAX_LOGO_PIXELS = 4_000_000
ATS_DOMAINS = ('myworkdayjobs.com', 'myworkdaysite.com', 'workday.com', 'lever.co',
               'greenhouse.io', 'ashbyhq.com', 'smartrecruiters.com', 'icims.com',
               'successfactors.com', 'successfactors.eu', 'oraclecloud.com',
               'darwinbox.in', 'darwinbox.com', 'workable.com', 'recruitee.com')


def company_domain(value):
    if not isinstance(value, str):
        return None
    domain = value.strip().lower().removeprefix('www.')
    if not 3 <= len(domain) <= 253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', domain):
        return None
    if domain.endswith(('.local', '.localhost', '.internal', '.test', '.invalid', '.example')):
        return None
    if any(domain == ats or domain.endswith('.' + ats) for ats in ATS_DOMAINS):
        return None
    return domain


def official_url(value, domain):
    try:
        url = urlsplit(value)
        return (len(value) <= 2048 and url.scheme == 'https' and not url.username and not url.password
                and url.port in (None, 443) and bool(url.hostname)
                and (url.hostname == domain or url.hostname.endswith('.' + domain)))
    except (TypeError, ValueError):
        return False


class PublicResolver(aiohttp.abc.AbstractResolver):
    """The connector uses these checked IPs directly, including after redirects."""
    def __init__(self):
        self.base = aiohttp.resolver.DefaultResolver()

    async def resolve(self, host, port=0, family=0):
        rows = await self.base.resolve(host, port, family)
        if not rows or any(not ipaddress.ip_address(row['host']).is_global for row in rows):
            raise OSError('Employer icon host must resolve to public addresses')
        return rows

    async def close(self):
        await self.base.close()


def decode_logo(data):
    if not data or len(data) > MAX_LOGO_BYTES:
        return None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in {'PNG', 'JPEG', 'WEBP', 'ICO', 'GIF'} or image.width * image.height > MAX_LOGO_PIXELS:
                    return None
                image.seek(0)
                logo = image.convert('RGBA')
                bounds = logo.getbbox()
                return logo.crop(bounds) if bounds else None
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return None


class IconLinks(HTMLParser):
    def __init__(self, page_url, domain):
        super().__init__()
        self.page_url, self.domain, self.icons = page_url, domain, []

    def handle_starttag(self, tag, attrs):
        if tag != 'link' or len(self.icons) >= 40:
            return
        attrs = dict(attrs)
        rel = (attrs.get('rel') or '').lower().split()
        href = attrs.get('href') or ''
        if not any(value in rel for value in ('icon', 'apple-touch-icon', 'apple-touch-icon-precomposed')):
            return
        url = urljoin(self.page_url, href)
        if not official_url(url, self.domain) or urlsplit(url).path.lower().endswith('.svg') or 'svg' in (attrs.get('type') or ''):
            return
        size = max([int(value) for value in re.findall(r'\b(\d{1,4})x\d{1,4}\b', attrs.get('sizes') or '')] or [0])
        score = (1000 if any('apple-touch' in value for value in rel) else 0) + min(size, 512)
        self.icons.append((score, url))


async def _read(session, url, domain, limit):
    for _ in range(3):
        if not official_url(url, domain):
            return None
        async with session.get(url, allow_redirects=False) as response:
            if response.status in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers.get('Location', ''))
                continue
            if response.status != 200 or response.content_length is not None and response.content_length > limit:
                return None
            body = bytearray()
            async for chunk in response.content.iter_chunked(16384):
                body.extend(chunk)
                if len(body) > limit:
                    return None
            return bytes(body), str(response.url)
    return None


async def _load_logo(domain):
    resolver = PublicResolver()
    try:
        connector = aiohttp.TCPConnector(resolver=resolver, limit=2, use_dns_cache=False)
        async with aiohttp.ClientSession(connector=connector, trust_env=False,
                headers={'User-Agent': 'JobVerify-ReelRenderer/3.0'},
                timeout=aiohttp.ClientTimeout(total=6, connect=3)) as session:
            candidates = []
            try:
                page = await _read(session, 'https://' + domain + '/', domain, 256 * 1024)
                if page:
                    parser = IconLinks(page[1], domain)
                    parser.feed(page[0].decode('utf-8', errors='replace'))
                    candidates = [url for _, url in sorted(parser.icons, reverse=True)[:3]]
            except (aiohttp.ClientError, OSError, ValueError, TimeoutError):
                pass
            candidates += ['https://' + domain + '/apple-touch-icon.png', 'https://' + domain + '/favicon.ico']
            for url in dict.fromkeys(candidates):
                try:
                    result = await _read(session, url, domain, MAX_LOGO_BYTES)
                    if not result:
                        continue
                    data, source = result
                    logo = decode_logo(data)
                    if logo is not None:
                        return logo, {'domain': domain, 'sourceUrl': source, 'sha256': hashlib.sha256(data).hexdigest()}
                except (aiohttp.ClientError, OSError, ValueError, TimeoutError):
                    continue
        return None, {}
    finally:
        await resolver.close()


async def load_company_logo(facts):
    domain = company_domain(facts.get('companyDomain'))
    if not domain:
        return None, {}
    try:
        return await asyncio.wait_for(_load_logo(domain), timeout=18)
    except (aiohttp.ClientError, OSError, ValueError, TimeoutError):
        return None, {}
