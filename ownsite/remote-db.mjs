const fields = ['id', 'slug', 'title', 'displayTitle', 'kind', 'category', 'status', 'role', 'summary', 'theme', 'orientation'];
const allowed = new Set([...fields, 'liveUrl', 'embedAllowed', 'links', 'poster', 'reveal', 'featuredOrder', 'tools']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new Error('Portfolio API unavailable'); };
const text = (value, max = 12000) => typeof value === 'string' && value.length <= max;
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
function poster(value) { return value === null || (text(value, 500) && /^\/assets\/[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(value) && !value.split('/').includes('..')); }
function links(value) {
  if (!Array.isArray(value) || value.length > 32) fail();
  return value.map(link => {
    if (!object(link) || !text(link.label) || !httpsUrl(link.href)) fail();
    return { label: link.label, href: link.href };
  });
}
function work(value) {
  if (!object(value) || Object.keys(value).some(key => !allowed.has(key)) || fields.some(key => !text(value[key]))) fail();
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(value.slug) || typeof value.embedAllowed !== 'boolean' ||
      !poster(value.poster) || (value.liveUrl !== null && !httpsUrl(value.liveUrl)) ||
      (value.featuredOrder !== null && !Number.isSafeInteger(value.featuredOrder)) ||
      !Array.isArray(value.reveal) || value.reveal.length > 32 ||
      !['portrait', 'landscape'].includes(value.orientation)) fail();
  const reveal = value.reveal.map(part => {
    if (!object(part) || !text(part.heading) || !text(part.body)) fail();
    return { heading: part.heading, body: part.body };
  });
  if (value.tools !== undefined && (!Array.isArray(value.tools) || value.tools.length > 30)) fail();
  const tools = (value.tools ?? []).map(tool => {
    if (!object(tool) || !text(tool.label) || !httpsUrl(tool.href) || (tool.poster !== undefined && !poster(tool.poster))) fail();
    return { label: tool.label, href: tool.href, ...(tool.poster !== undefined ? { poster: tool.poster } : {}) };
  });
  return { ...Object.fromEntries(fields.map(key => [key, value[key]])), liveUrl: value.liveUrl,
    embedAllowed: value.embedAllowed, links: links(value.links), poster: value.poster, reveal,
    featuredOrder: value.featuredOrder, tools };
}

/** Read-only, bounded server-to-server adapter. No secret or browser credential. */
export function openRemotePortfolio(baseUrl, { fetchImpl = fetch, timeoutMs = 5000, maxBytes = 1024 * 1024, allowLoopback = false } = {}) {
  let base;
  try { base = new URL(baseUrl); } catch { fail(); }
  if (base.username || base.password || base.search || base.hash ||
      !['/ownsite', '/ownsite/'].includes(base.pathname) ||
      !(base.protocol === 'https:' || (allowLoopback && base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)))) fail();
  const prefix = `${base.origin}/ownsite`;
  async function read(path, missing = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(prefix + path, { headers: { accept: 'application/json' }, redirect: 'error', signal: controller.signal });
      if (missing && response.status === 404) return null;
      if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) fail();
      const size = response.headers.get('content-length');
      if (size !== null && (!/^\d+$/.test(size) || Number(size) > maxBytes)) fail();
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) { await reader.cancel(); fail(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { fail(); }
    finally { clearTimeout(timer); }
  }
  return {
    async publicWorks() {
      const values = await read('/api/works');
      if (!Array.isArray(values) || values.length > 1000) fail();
      const result = values.map(work);
      if (new Set(result.map(row => row.slug)).size !== result.length) fail();
      return result;
    },
    async publicWork(slug) {
      if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return null;
      const value = await read(`/api/works/${encodeURIComponent(slug)}`, true);
      if (value === null) return null;
      const result = work(value);
      if (result.slug !== slug) fail();
      return result;
    },
    async publicContacts() {
      const values = await read('/api/contacts');
      if (!Array.isArray(values) || values.length > 3) fail();
      return values.map(value => {
        if (!object(value) || !text(value.label, 300) || !text(value.href, 300) ||
            !(/^tel:\+[0-9]{10,15}$/.test(value.href) || /^mailto:[^\s@?#]+@[^\s@?#]+\.[^\s@?#]+$/.test(value.href) || /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\/?$/.test(value.href))) fail();
        return { label: value.label, href: value.href };
      });
    }
  };
}
