"""Company identity, bounded image decoding and safe official-site lookups."""
import asyncio
from io import BytesIO
import unittest
from unittest.mock import AsyncMock, patch
from PIL import Image
import branding


class BrandingTests(unittest.TestCase):
    def test_domain_uses_only_explicit_employer_identity(self):
        self.assertEqual(branding.company_domain('WWW.Microsoft.com'), 'microsoft.com')
        for value in [None, '', 'Microsoft', '127.0.0.1', '169.254.169.254', 'localhost', 'company.local', 'https://example.com/a', 'user@example.com', 'example.com:443', 'jobs.lever.co', 'acme.wd5.myworkdayjobs.com']:
            self.assertIsNone(branding.company_domain(value), value)

    def test_icon_sources_stay_on_the_employer_site(self):
        domain = 'example.com'
        self.assertTrue(branding.official_url('https://www.example.com/assets/logo.png', domain))
        for value in ['http://example.com/a', 'https://example.com.attacker.com/a', 'https://127.0.0.1/a', 'https://user@example.com/a', 'https://example.com:8443/a', 'file:///logo.png', 'https://cdn.other.com/logo.png']:
            self.assertFalse(branding.official_url(value, domain), value)

    def test_transparent_png_and_ico_decode_but_html_and_oversize_do_not(self):
        image = Image.new('RGBA', (128, 64), (12, 34, 56, 128))
        png = BytesIO(); image.save(png, format='PNG')
        self.assertEqual(branding.decode_logo(png.getvalue()).size, (128, 64))
        ico = BytesIO(); image.resize((64, 64)).save(ico, format='ICO')
        self.assertEqual(branding.decode_logo(ico.getvalue()).size, (64, 64))
        self.assertIsNone(branding.decode_logo(b'<html>not a logo</html>'))
        self.assertIsNone(branding.decode_logo(b'x' * (1024 * 1024 + 1)))
        large = BytesIO(); Image.new('RGB', (2100, 2100)).save(large, format='PNG')
        self.assertIsNone(branding.decode_logo(large.getvalue()))

    def test_unknown_or_unreachable_logos_fall_back_without_failing_the_reel(self):
        self.assertEqual(asyncio.run(branding.load_company_logo({'company': 'No domain'})), (None, {}))
        with patch.object(branding, '_load_logo', new=AsyncMock(side_effect=TimeoutError)):
            self.assertEqual(asyncio.run(branding.load_company_logo({'companyDomain': 'example.com'})), (None, {}))

    def test_resolver_rejects_private_addresses_before_any_connection(self):
        rows = [{'host': '127.0.0.1'}, {'host': '::1'}, {'host': '169.254.169.254'}, {'host': '10.1.2.3'}]
        async def check():
            resolver = branding.PublicResolver()
            try:
                for row in rows:
                    with patch.object(resolver.base, 'resolve', new=AsyncMock(return_value=[row])):
                        with self.assertRaises(OSError):
                            await resolver.resolve('example.com')
            finally:
                await resolver.close()
        asyncio.run(check())


if __name__ == '__main__':
    unittest.main()
