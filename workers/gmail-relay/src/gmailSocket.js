import tls from 'node:tls';

// Workers can open Gmail TLS by hostname. Let the runtime resolve that hostname
// instead of using Nodemailer's DNS/address-family connection setup.
export function openGmailSocket(_options, callback) {
  let socket;
  let settled = false;
  const finish = error => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) socket?.destroy();
    callback(error ?? null, error ? undefined : { connection: socket, secured: true });
  };
  const timer = setTimeout(() => {
    finish(Object.assign(new Error('Gmail TLS handshake timed out.'), { code: 'ETIMEDOUT' }));
  }, 10_000);
  try {
    socket = tls.connect({
      host: 'smtp.gmail.com', port: 465,
      servername: 'smtp.gmail.com', rejectUnauthorized: true,
    });
    socket.once('secureConnect', () => finish());
    socket.once('error', finish);
  } catch (error) { finish(error); }
}
