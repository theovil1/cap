// Publishes the base routes of routes.json as the signed-in account (the Cap
// team), with the destination photo from Wikimedia Commons and its credit.
// Routes already published by this account (same title) are skipped.
//
//   CAP_EMAIL=... CAP_PASSWORD=... node seed.mjs [--api https://cap.theovilain.fr]

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const API = args.includes('--api') ? args[args.indexOf('--api') + 1] : 'http://localhost:8080';
const AGENT = {
  'User-Agent': 'cap-base-routes/0.1 (https://github.com/theovil1/cap)',
};
const routes = JSON.parse(await readFile(new URL('./routes.json', import.meta.url), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let token;
async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof Uint8Array ? body : body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** A 1600 px JPEG of a Commons file, with "Author, licence, Wikimedia Commons". */
async function commons(file) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    format: 'json',
    titles: file,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1600',
  };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: AGENT });
    const text = await res.text();
    if (text.startsWith('{')) {
      const info = Object.values(JSON.parse(text).query.pages)[0].imageinfo[0];
      const meta = info.extmetadata;
      const artist = meta.Artist.value.replace(/<[^>]+>/g, '').trim();
      const licence = meta.LicenseShortName.value;
      if (!/^(CC BY|CC0|Public domain)/i.test(licence)) throw new Error(`${file}: ${licence}`);
      const image = await fetch(info.thumburl, { headers: AGENT });
      const bytes = new Uint8Array(await image.arrayBuffer());
      return {
        bytes,
        credit: `${artist}, ${licence}, Wikimedia Commons`.slice(0, 200),
      };
    }
    if (attempt === 4) throw new Error(`${file}: ${text.slice(0, 80)}`);
    await sleep(10_000 * (attempt + 1));
  }
}

const auth = await api('/auth/login', {
  method: 'POST',
  body: { email: process.env.CAP_EMAIL, password: process.env.CAP_PASSWORD },
});
token = auth.access_token;
const me = auth.user.id;

for (const route of routes) {
  const found = await api(`/public-routes?q=${encodeURIComponent(route.title)}&limit=50`);
  if (found.some((r) => r.author.id === me && r.title === route.title)) {
    console.log(`= ${route.title}`);
    continue;
  }
  const computed = await api('/routes', {
    method: 'POST',
    body: { start: route.start, end: route.end },
  });
  const published = await api('/public-routes', {
    method: 'POST',
    body: {
      route_id: computed.id,
      title: route.title,
      description: route.description,
      tags: route.tags,
    },
  });
  if (route.photo) {
    const { bytes, credit } = await commons(route.photo);
    await api(`/public-routes/${published.id}/photos/end?credit=${encodeURIComponent(credit)}`, {
      method: 'PUT',
      body: bytes,
      headers: { 'content-type': 'image/jpeg' },
    });
    await sleep(2_000);
  }
  console.log(`+ ${route.title} (${Math.round(computed.distance_m / 1000)} km)`);
}
