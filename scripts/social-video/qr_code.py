"""High contrast QR codes for the exact API-selected JobVerify job page."""
import re
import qrcode
from PIL import Image


def valid_job_url(url, job_id):
    return (isinstance(job_id, str) and bool(re.fullmatch(r'[a-fA-F0-9]{24}', job_id))
            and url == f'https://www.jobverify.in/jobs/{job_id}')


def job_qr(url, size=840):
    if not isinstance(url, str) or not re.fullmatch(r'https://www\.jobverify\.in/jobs/[a-fA-F0-9]{24}', url):
        raise ValueError('QR code requires a JobVerify job URL')
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=1, border=4)
    code.add_data(url); code.make(fit=True)
    image = code.make_image(fill_color='#201a3c', back_color='white').convert('RGB')
    # An integer module size and four-module quiet zone keep the code scannable.
    factor = max(1, size // image.width)
    return image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST)
