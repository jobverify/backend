The bundled public certificate is published by GoDaddy at https://certs.godaddy.com/repository/gd_tls_root-r1-cross-g2.crt.pem (verified 2026-10-09).

SHA-256 certificate fingerprint: 7B:CB:0F:2F:2D:10:31:A6:AF:8D:61:BA:A8:35:D2:83:5A:3B:8B:CC:26:D9:4A:3B:04:8B:16:55:FB:81:29:8C.

It is a non-self-signed R1-to-G2 cross certificate. Okinawa currently sends a leaf and R1 intermediate without this compatible cross-chain. The source supplements its TLS chain only for the exact verified employer host. It requires the existing self-signed GoDaddy G2 root in Node's default trust store, verifies the cross signature and validity, keeps hostname and expiry validation enabled, and explicitly disables partial-chain trust. It never adds a self-signed root or changes global trust settings. Without the existing trusted G2 anchor the chain must fail.
