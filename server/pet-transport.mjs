import { createHash } from 'node:crypto';
import { createGzip, gzipSync, constants } from 'node:zlib';

const streams = new WeakMap();
const gzipOptions = { level: constants.Z_BEST_SPEED };
function acceptsGzip(request) {
  const encodings = new Map(String(request.headers?.['accept-encoding'] || '').toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';');
    const q = parameters.find(value => value.trim().startsWith('q='));
    return [name, q ? Number(q.trim().slice(2)) : 1];
  }));
  return (encodings.get('gzip') ?? encodings.get('*') ?? 0) > 0;
}
function vary(response) {
  return [...new Set(String(response.getHeader?.('Vary') || '').split(',').map(value => value.trim()).filter(Boolean).concat('Accept-Encoding'))].join(', ');
}

/** The payload and save receipt stay identical; compression is transport only. */
export function sendPetJson(request, response, status, body, extra = {}, encoded) {
  if (response.headersSent || response.destroyed) return;
  const headers = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', Vary:vary(response), ...extra };
  if (status === 304) { response.writeHead(status, headers); response.end(); return; }
  let bytes = encoded ?? Buffer.from(JSON.stringify(body));
  if (bytes.length >= 1024 && acceptsGzip(request)) {
    const compressed = gzipSync(bytes, gzipOptions);
    if (compressed.length < bytes.length) { bytes = compressed; headers['Content-Encoding'] = 'gzip'; }
  }
  headers['Content-Length'] = bytes.length;
  response.writeHead(status, headers); response.end(bytes);
}

/** Hash the complete envelope, including compatibility metadata, not just its
 * revision. No shared cache and no browser disk cache are introduced. */
export function sendPetSnapshot(request, response, snapshot) {
  const bytes = Buffer.from(JSON.stringify(snapshot));
  const etag = `W/"pet-${createHash('sha256').update(bytes).digest('hex')}"`;
  const matches = String(request.headers?.['if-none-match'] || '').split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag.slice(2));
  sendPetJson(request, response, matches ? 304 : 200, snapshot, { ETag:etag, 'Cache-Control':'private, no-store', 'Access-Control-Expose-Headers':'ETag' }, bytes);
}

export function startPetEventStream(request, response) {
  const compressed = acceptsGzip(request);
  response.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive', 'X-Accel-Buffering':'no', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', Vary:vary(response), ...(compressed ? {'Content-Encoding':'gzip'} : {}) });
  if (!compressed) return;
  const gzip = createGzip(gzipOptions); streams.set(response, gzip);
  gzip.on('error', () => response.destroy());
  response.on('close', () => { streams.delete(response); gzip.destroy(); });
  gzip.pipe(response);
}
export function writePetEvent(response, packet) {
  if (response.destroyed || response.writableEnded) return;
  const gzip = streams.get(response);
  if (!gzip) { response.write(packet); return; }
  // Flush each event so small partner updates never wait for a gzip buffer.
  gzip.write(packet); gzip.flush(constants.Z_SYNC_FLUSH);
}
export function endPetEventStream(response) {
  const gzip = streams.get(response);
  if (gzip) gzip.end(); else response.end();
}
