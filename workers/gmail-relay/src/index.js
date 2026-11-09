import nodemailer from 'nodemailer';
import { createRelayHandler } from './relay.js';
import { openGmailSocket } from './gmailSocket.js';

export default {
  fetch: createRelayHandler({ createTransport: options => nodemailer.createTransport({ ...options, getSocket: openGmailSocket }) }),
};
