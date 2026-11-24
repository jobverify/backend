import { socialError } from './policy.js';

// Parse the bytes ourselves: runner claims and MIME types are never evidence of
// a valid movie. Accept the single-track-pair, non-fragmented template format.
const bad = () => { throw socialError('Invalid MP4 media structure or unsupported Reel encoding.'); };
function boxes(bytes, start = 0, end = bytes.length) {
  const rows = [];
  for (let at = start; at < end;) {
    if (at + 8 > end || rows.length > 10000) bad();
    let size = bytes.readUInt32BE(at); let header = 8;
    if (size === 1) { if (at + 16 > end) bad(); size = Number(bytes.readBigUInt64BE(at + 8)); header = 16; }
    if (size < header || !Number.isSafeInteger(size) || at + size > end) bad();
    rows.push({ type: bytes.toString('ascii', at + 4, at + 8), at, start: at + header, end: at + size }); at += size;
  }
  return rows;
}
const one = (list, type) => { const found = list.filter(box => box.type === type); if (found.length !== 1) bad(); return found[0]; };
class Bits {
  constructor(data) { this.data = data; this.at = 0; }
  read(n = 1) { if (n > 32 || this.at + n > this.data.length * 8) bad(); let v = 0; while (n--) { v = v * 2 + ((this.data[this.at >> 3] >> (7 - (this.at & 7))) & 1); this.at++; } return v; }
  ue() { let n = 0; while (!this.read()) if (++n > 25) bad(); return 2 ** n - 1 + this.read(n); }
  se() { const v = this.ue(); return v & 1 ? (v + 1) / 2 : -v / 2; }
}
function spsProperties(nal) {
  if ((nal[0] & 31) !== 7) bad();
  const rbsp = []; for (let i = 1; i < nal.length; i++) { if (i >= 3 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue; rbsp.push(nal[i]); }
  const b = new Bits(rbsp); const profile = b.read(8); b.read(16); b.ue(); let chroma = 1;
  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profile)) {
    chroma = b.ue(); if (chroma === 3) b.read();
    if (b.ue() !== 0 || b.ue() !== 0) bad(); // 8-bit only
    b.read(); if (b.read()) bad(); // template never needs custom scaling lists
  }
  b.ue(); const order = b.ue();
  if (order === 0) b.ue();
  else if (order === 1) { b.read(); b.se(); b.se(); const n = b.ue(); if (n > 255) bad(); for (let i = 0; i < n; i++) b.se(); }
  else if (order !== 2) bad();
  b.ue(); b.read(); const w = b.ue(); const h = b.ue(); const progressive = b.read();
  if (!progressive) bad(); b.read(); let left = 0; let right = 0; let top = 0; let bottom = 0;
  if (b.read()) { left = b.ue(); right = b.ue(); top = b.ue(); bottom = b.ue(); }
  if (chroma !== 1) bad();
  return { width: (w + 1) * 16 - (left + right) * 2, height: (h + 1) * 16 - (top + bottom) * 2 };
}
function avcConfig(bytes, box) {
  const data = bytes.subarray(box.start, box.end); if (data.length < 8 || data[0] !== 1) bad();
  const lengthBytes = (data[4] & 3) + 1; if (lengthBytes !== 4 || (data[5] & 31) !== 1) bad();
  const size = data.readUInt16BE(6); if (8 + size + 1 >= data.length) bad();
  const props = spsProperties(data.subarray(8, 8 + size));
  let at = 8 + size; const count = data[at++]; if (!count) bad();
  for (let i = 0; i < count; i++) { if (at + 2 > data.length) bad(); const n = data.readUInt16BE(at); at += 2; if (!n || at + n > data.length || (data[at] & 31) !== 8) bad(); at += n; }
  return props;
}
function audioConfig(bytes, box) {
  const d = bytes.subarray(box.start + 4, box.end);
  const descriptor = (at, end) => {
    const tag = d[at++]; let size = 0; let next; for (let i = 0; i < 4; i++) { if (at >= end) bad(); next = d[at++]; size = size * 128 + (next & 127); if (!(next & 128)) break; } if (next & 128 || at + size > end) bad();
    return { tag, start: at, end: at + size };
  };
  const es = descriptor(0, d.length); if (es.tag !== 3 || es.start + 3 > es.end) bad();
  const flags = d[es.start + 2]; let at = es.start + 3;
  if (flags & 128) at += 2; if (flags & 64) at += 1 + d[at]; if (flags & 32) at += 2;
  const decoder = descriptor(at, es.end); if (decoder.tag !== 4 || decoder.start + 13 > decoder.end || d[decoder.start] !== 0x40) bad();
  const bitrate = d.readUInt32BE(decoder.start + 9); if (bitrate < 110000 || bitrate > 150000) bad();
  const info = descriptor(decoder.start + 13, decoder.end); if (info.tag !== 5 || info.end - info.start < 2) bad();
  const bits = new Bits(d.subarray(info.start, info.end)); if (bits.read(5) !== 2 || bits.read(4) !== 3 || ![1, 2].includes(bits.read(4))) bad();
}

function table(bytes, box, stride, prefix = 8) {
  if (box.end - box.start < prefix) bad(); const n = bytes.readUInt32BE(box.start + 4);
  if (n > 100000 || box.start + prefix + n * stride !== box.end) bad();
  return Array.from({ length: n }, (_, i) => box.start + prefix + i * stride);
}
function sampleLayout(bytes, stbl, mdat) {
  const sz = one(stbl, 'stsz'); if (sz.end - sz.start < 12) bad();
  const fixed = bytes.readUInt32BE(sz.start + 4); const n = bytes.readUInt32BE(sz.start + 8);
  if (!n || n > 100000 || sz.start + 12 + (fixed ? 0 : n * 4) !== sz.end) bad();
  const sizes = Array.from({ length: n }, (_, i) => fixed || bytes.readUInt32BE(sz.start + 12 + i * 4));
  const co = stbl.find(box => box.type === 'stco' || box.type === 'co64'); if (!co) bad();
  const offsets = table(bytes, co, co.type === 'co64' ? 8 : 4).map(at => co.type === 'co64' ? Number(bytes.readBigUInt64BE(at)) : bytes.readUInt32BE(at));
  const sc = table(bytes, one(stbl, 'stsc'), 12).map(at => [bytes.readUInt32BE(at), bytes.readUInt32BE(at + 4), bytes.readUInt32BE(at + 8)]);
  if (!sc.length || sc[0][0] !== 1 || sc.some((v, i) => !v[1] || v[2] !== 1 || (i && v[0] <= sc[i - 1][0]))) bad();
  const samples = []; let sample = 0; let mapping = 0;
  for (let i = 0; i < offsets.length; i++) {
    while (mapping + 1 < sc.length && sc[mapping + 1][0] <= i + 1) mapping++;
    let at = offsets[i];
    for (let j = 0; j < sc[mapping][1]; j++) { const size = sizes[sample++]; if (!size || at < mdat.start || at + size > mdat.end) bad(); samples.push([at, size]); at += size; }
  }
  if (sample !== n) bad(); return samples;
}
export function validateReelMp4(bytes) {
  try {
    const root = boxes(bytes); const ftyp = one(root, 'ftyp'); const moov = one(root, 'moov'); const mdat = one(root, 'mdat');
    if (ftyp.at !== 0 || moov.at > mdat.at || root.some(box => ['moof', 'mfra'].includes(box.type))) bad();
    const tracks = boxes(bytes, moov.start, moov.end).filter(box => box.type === 'trak'); if (tracks.length !== 2) bad();
    let video; let audio;
    for (const track of tracks) {
      const mdia = one(boxes(bytes, track.start, track.end), 'mdia'); const media = boxes(bytes, mdia.start, mdia.end);
      const hdlr = one(media, 'hdlr'); const handler = bytes.toString('ascii', hdlr.start + 8, hdlr.start + 12);
      const mdhd = one(media, 'mdhd'); const v = bytes[mdhd.start]; if (![0, 1].includes(v)) bad();
      const scale = bytes.readUInt32BE(mdhd.start + (v ? 20 : 12)); const duration = (v ? Number(bytes.readBigUInt64BE(mdhd.start + 24)) : bytes.readUInt32BE(mdhd.start + 16)) / scale;
      if (!Number.isFinite(duration) || duration < 15 || duration > 30.1) bad();
      const minf = one(media, 'minf'); const stblBox = one(boxes(bytes, minf.start, minf.end), 'stbl'); const stbl = boxes(bytes, stblBox.start, stblBox.end);
      const sd = one(stbl, 'stsd'); if (bytes.readUInt32BE(sd.start + 4) !== 1) bad(); const entry = boxes(bytes, sd.start + 8, sd.end); if (entry.length !== 1) bad(); const e = entry[0];
      const samples = sampleLayout(bytes, stbl, mdat); const timings = table(bytes, one(stbl, 'stts'), 8);
      let frames = 0; let ticks = 0; for (const at of timings) { const n = bytes.readUInt32BE(at); const delta = bytes.readUInt32BE(at + 4); if (!n || !delta) bad(); frames += n; ticks += n * delta; if (handler === 'vide' && Math.abs(scale / delta - 30) > 0.001) bad(); }
      if (frames !== samples.length || Math.abs(ticks / scale - duration) > 0.1) bad();
      if (handler === 'vide') {
        if (video || e.type !== 'avc1' || e.end - e.start < 78 || bytes.readUInt16BE(e.start + 24) !== 1080 || bytes.readUInt16BE(e.start + 26) !== 1920) bad();
        const props = avcConfig(bytes, one(boxes(bytes, e.start + 78, e.end), 'avcC')); if (props.width !== 1080 || props.height !== 1920) bad();
        const sync = table(bytes, one(stbl, 'stss'), 4).map(at => bytes.readUInt32BE(at)); if (sync[0] !== 1 || sync.some((n, i) => n > samples.length || (i && n <= sync[i - 1]))) bad();
        const keys = new Set(sync);
        for (let i = 0; i < samples.length; i++) { const [start, size] = samples[i]; let at = start; let slice = false; let idr = false; while (at < start + size) { if (at + 4 >= start + size) bad(); const n = bytes.readUInt32BE(at); at += 4; if (!n || at + n > start + size) bad(); const kind = bytes[at] & 31; if ([1, 5].includes(kind)) slice = true; if (kind === 5) idr = true; at += n; } if (!slice || (keys.has(i + 1) && !idr)) bad(); }
        video = { ...props, duration, fps: 30, codec: 'h264', pixelFormat: 'yuv420p', progressive: true, closedGop: true, fastStart: true };
      } else if (handler === 'soun') {
        if (audio || e.type !== 'mp4a' || e.end - e.start < 28 || bytes.readUInt32BE(e.start + 24) / 65536 !== 48000) bad();
        audioConfig(bytes, one(boxes(bytes, e.start + 28, e.end), 'esds'));
        // Encoder descriptors are mutable metadata. Bound and persist the
        // actual payload rate from validated sample spans and media timing.
        const bitrate = Math.round(samples.reduce((total, sample) => total + sample[1], 0) * 8 / (ticks / scale));
        if (bitrate < 110000 || bitrate > 150000) bad();
        audio = { audioCodec: 'aac', audioSampleRate: 48000, audioBitrate: bitrate, duration };
      } else bad();
    }
    if (!video || !audio || Math.abs(video.duration - audio.duration) > 0.2) bad();
    return { ...video, audioCodec: audio.audioCodec, audioSampleRate: audio.audioSampleRate, audioBitrate: audio.audioBitrate };
  } catch (error) { if (error.statusCode) throw error; bad(); }
}
