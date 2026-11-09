import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";

import { sendVerificationEmail } from "../src/utils/sendEmail.js";

const SMTP_ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];

const withSmtpEnvironment = async (values, callback) => {
  const original = Object.fromEntries(SMTP_ENV_KEYS.map((key) => [key, process.env[key]]));

  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const startSmtpServer = async () => {
  let message = "";
  const server = net.createServer((socket) => {
    let buffer = "";
    let receivingMessage = false;

    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      if (receivingMessage) {
        const terminatorIndex = buffer.indexOf("\r\n.\r\n");
        if (terminatorIndex === -1) return;

        message += buffer.slice(0, terminatorIndex);
        buffer = buffer.slice(terminatorIndex + 5);
        receivingMessage = false;
        socket.write("250 queued\r\n");
      }

      while (!receivingMessage) {
        const lineEnd = buffer.indexOf("\r\n");
        if (lineEnd === -1) return;

        const command = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);

        if (/^EHLO /i.test(command)) socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (/^AUTH /i.test(command)) socket.write("235 authenticated\r\n");
        else if (/^MAIL FROM:/i.test(command) || /^RCPT TO:/i.test(command)) socket.write("250 accepted\r\n");
        else if (command === "DATA") {
          receivingMessage = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (command === "QUIT") {
          socket.write("221 goodbye\r\n");
          socket.end();
        }
      }
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    getMessage: () => message,
    port,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
};

test("sendVerificationEmail delivers the verification link through configured SMTP", async () => {
  const smtpServer = await startSmtpServer();

  try {
    await withSmtpEnvironment({
      SMTP_HOST: "localhost",
      SMTP_PORT: String(smtpServer.port),
      SMTP_SECURE: "false",
      SMTP_USER: "noreply@jobverify.test",
      SMTP_PASS: "app-password",
      SMTP_FROM: "Jobverify <noreply@jobverify.test>",
    }, async () => {
      await sendVerificationEmail(
        "student@example.com",
        "https://jobverify.test/verify-email#token=abc123",
      );
    });

    const message = smtpServer.getMessage();
    assert.match(message, /To: student@example\.com/);
    assert.match(message, /Subject: Verify your Jobverify account/);
    assert.match(message, /Verify Email Address/);
    assert.match(message, /abc123/);
  } finally {
    await smtpServer.close();
  }
});

test("sendVerificationEmail rejects when SMTP credentials are not configured", async () => {
  await withSmtpEnvironment({
    SMTP_HOST: "",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "noreply@jobverify.test",
    SMTP_PASS: "app-password",
    SMTP_FROM: "Jobverify <noreply@jobverify.test>",
  }, async () => {
    await assert.rejects(
      sendVerificationEmail("student@example.com", "https://jobverify.test/verify-email#token=abc123"),
      /SMTP_HOST environment variable is not defined/,
    );
  });
});
