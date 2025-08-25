import fetch from 'node-fetch';
import { load } from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname.replace(/\\scripts$/, '');

const pages = [
  { url: 'https://deepwebnest.com/games.html', outfile: 'data/games-primary.json', selector: '.container' },
  { url: 'https://deepwebnest.com/anime.html', outfile: 'data/anime.json', selector: '.container' },
  { url: 'https://deepwebnest.com/music.html', outfile: 'data/music.json', selector: '.container' },
  { url: 'https://deepwebnest.com/books.html', outfile: 'data/books.json', selector: '.container' },
  { url: 'https://deepwebnest.com/software.html', outfile: 'data/software.json', selector: '.container' },
  { url: 'https://deepwebnest.com/streaming.html', outfile: 'data/streaming.json', selector: '.container' },
  { url: 'https://deepwebnest.com/movies.html', outfile: 'data/movies.json', selector: '.container' },
  { url: 'https://deepwebnest.com/vpn.html', outfile: 'data/vpn.json', selector: '.container' },
  { url: 'https://deepwebnest.com/adblockers.html', outfile: 'data/adblockers.json', selector: '.container' }
];

function extractLinks(html) {
  const $ = load(html);
  const items = [];
  $('a').each((_, el) => {
    const label = $(el).text().trim().replace(/\s+/g, ' ');
    const url = $(el).attr('href');
    if (!url || !label) return;
    if (url.startsWith('#')) return;
    if (/^mailto:|^tel:/.test(url)) return;
    items.push({ label, url });
  });
  return items;
}

async function scrapeAll() {
  for (const page of pages) {
    try {
      const res = await fetch(page.url);
      const html = await res.text();
      const items = extractLinks(html);
      const out = { items };
      const path = `${root}/${page.outfile}`;
      mkdirSync(`${root}/data`, { recursive: true });
      writeFileSync(path, JSON.stringify(out, null, 2));
      console.log('Wrote', path, items.length);
    } catch (e) {
      console.error('Failed:', page.url, e.message);
    }
  }
}

scrapeAll();
