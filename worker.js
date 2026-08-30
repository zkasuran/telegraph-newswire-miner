// Telegraph news miner: two intents, NEWS_HEADLINES and NEWS_SEARCH.
//
// Every answer is a live read of a public feed at request time, and every source is one whose own
// licence grants a commercial service the right to republish what it returns:
//
//   Global Voices        CC BY 3.0, reuse "for any purpose, even commercially"
//   Wikinews             CC BY 4.0 for anything published after 16 December 2024
//   European Commission  CC BY 4.0 per its own legal notice, press releases included
//   NASA, NIST, NSF, DOE works of the US Government, which carry no copyright at all
//
// The publisher feeds this miner read before are gone for licence reasons, not technical ones.
// BBC Terms of Use section 15a opens "You're not allowed to pluck metadata from our content or
// RSS feeds", which is exactly what parsing their RSS and republishing the titles is, and the NPR
// feed ships "Copyright 2024 NPR - For Personal Use Only". Google News RSS answers 503 from a
// Cloudflare edge IP and its terms bar the use anyway. GDELT grants its data freely for any
// commercial use, which would have been ideal, but from the edge it returns 522 or 525 after 19 to
// 44 seconds, so it cannot answer a spot check and is not called.
//
// The credit each licence asks for travels in every answer, in `attribution`, as well as in
// NOTICE and DATA-SOURCES.md.
//
// All feeds are read in parallel and pooled rather than tried in order: each is narrow on its own,
// so a topic is far likelier to be covered by one of six than by any single one. A headline answer
// is held to the last fortnight, because a question about what is in the news now is not answered
// by an archive article however well it matches the words.

/**
 * Licence: source-available, no derivatives. Copyright (c) 2026 zkasuran.
 * SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
 *
 * Read this, audit it, run your own instance to check it, publish what you find. Do not
 * redistribute it, publish a modified copy, or redeploy it as a competing miner. Calling
 * the live endpoint is not restricted by the licence at all.
 *
 * Full terms: LICENSE. Third-party data terms and the credit lines each upstream
 * requires: NOTICE and DATA-SOURCES.md. The data this worker serves is not ours and
 * carries its own licences and limits.
 */
const GLOBALVOICES = 'https://globalvoices.org/feed/';
// Wikinews is CC BY 4.0 for anything published after 16 December 2024, credited to Wikinews.
const WIKINEWS = 'https://en.wikinews.org/w/api.php';
// NASA news releases are works of the US Government, so they carry no copyright at all.
const NASA = 'https://www.nasa.gov/news-release/feed/';
// The European Commission licenses its website content, press releases included, under CC BY 4.0:
// "reuse is allowed, provided appropriate credit is given and changes are indicated".
const EC_PRESS = 'https://ec.europa.eu/commission/presscorner/api/rss?language=en&pagesize=15';
// Three more US Government newsrooms, for the technology and science coverage the other feeds are
// thin on. A work of the US Government carries no copyright, so there is nothing to license.
const US_GOV_FEEDS = [
  ['https://www.nist.gov/news-events/news/rss.xml', 'NIST'],
  ['https://www.nsf.gov/rss/rss_www_news.xml', 'the US National Science Foundation'],
  ['https://www.energy.gov/rss/articles.xml', 'the US Department of Energy'],
];
const CREDIT_GV = 'Reporting from Global Voices, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).';
const CREDIT_WIKINEWS = 'Reporting from Wikinews, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).';
const CREDIT_NASA = 'News releases from NASA, a work of the United States Government.';
// One name for the whole source set, used wherever an answer reports which feeds were read.
const LICENSED_FEEDS = 'Global Voices, Wikinews, the European Commission, NASA, NIST, the NSF and the US Department of Energy';
const CREDIT_USGOV = 'News releases from United States Government agencies, which carry no copyright.';
const CREDIT_EC = 'Press releases (C) European Union, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), summarised here.';

// The publisher feeds this miner read before are gone for licence reasons, not technical ones.
// The BBC Terms of Use section 15a opens "You're not allowed to pluck metadata from our content
// or RSS feeds", which is precisely what parsing their RSS and republishing the titles is, and
// the NPR feed ships the line "Copyright 2024 NPR - For Personal Use Only". Neither can be
// served by a miner paid per answer, so neither is called.
//
// A topic becomes a GDELT query. GDELT answers from a Cloudflare edge IP only when the query
// carries a language filter, and it takes about 28 seconds cold, so the timeout is generous and
// Wikinews answers alongside it.
// Topic words that broaden a query, kept because a bare word like "tech" finds little.
const CATEGORY = {
  world: 'world', international: 'world', global: 'world',
  business: 'business', economy: 'business', finance: 'business', markets: 'business',
  politics: 'politics', election: 'politics', government: 'politics',
  technology: 'technology', tech: 'technology', ai: 'technology', software: 'technology',
  science: 'science', climate: 'science', environment: 'science', space: 'science',
  health: 'health', medicine: 'health', covid: 'health',
  entertainment: 'entertainment', film: 'entertainment', music: 'entertainment', arts: 'entertainment',
  education: 'education', school: 'education',
};
// Every feed here asks an automated client to identify itself with a contact.
const UA = 'telegraph-newswire-miner/1.0 (+https://github.com/zkasuran/telegraph-newswire-miner; zkasuran@gmail.com)';

// The node probes declared paths with the template left unfilled ("/headlines/{topic}"
// or "/news/%7Bquery%7D"). An unfilled slot has named nothing, so it resolves to a
// sensible default and answers 200. A 400 there reads as "miner did not respond" and
// freezes the miner out of routing for a whole epoch, the lesson the sky and chain
// miners were built on.
const TEMPLATE = /^(\{.*\}|%7b.*%7d|:?(topic|category|query|q|search|question|keyword|keywords))$/i;

// Filler words stripped when pulling a topic or a query out of a whole question, so
// "what are the top headlines about bitcoin" resolves to "bitcoin". Longer and
// apostrophe forms come first so they match before the bare word. Two regexes on
// purpose: HAS is stateless for .test(), ALL is global for .replace(); reusing one
// global regex for .test() keeps lastIndex between calls and parses the same input
// differently on alternating requests in a long-lived isolate.
const HL_FILLER = "what's|whats|what is|what are|headlines|headline|stories|story|latest|current|recent|breaking|news|about|regarding|around|related|category|topic|please|today|show|tell|give|me|any|now|the|top|are|is|on|for|in|to|of|what";
const NS_FILLER = "what's|whats|what is|search for|search|find me|find|look up|look|articles|article|stories|story|latest|recent|relevant|most|regarding|around|related|about|news|please|today|show|tell|give|know|have|you|do|the|for|on|to|of|me|any|now|is|are|up|what";
const HL_HAS = new RegExp(`\\b(?:${HL_FILLER})\\b`, 'i');
const HL_ALL = new RegExp(`\\b(?:${HL_FILLER})\\b`, 'gi');
const NS_HAS = new RegExp(`\\b(?:${NS_FILLER})\\b`, 'i');
const NS_ALL = new RegExp(`\\b(?:${NS_FILLER})\\b`, 'gi');

function extractTerm(raw, has, all) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (TEMPLATE.test(s)) return null;
  s = s.replace(/[?!.]+$/, '').trim();
  if (!/\s/.test(s) || !has.test(s)) return s;
  const cleaned = s.replace(all, ' ').replace(/[?!.,]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}
// RSS helpers, no library. Strip CDATA first, then decode the HTML entities Google
// News uses in titles, decoding &amp; last so an escaped "&amp;lt;" never turns into a tag.
function stripCdata(s) {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}
function clean(s) {
  return decodeEntities(stripCdata(s)).replace(/\s+/g, ' ').trim();
}
function cleanTitle(title, source) {
  if (source && title.endsWith(` - ${source}`)) return title.slice(0, -(source.length + 3)).trim();
  return title;
}
// A plain "how recent" phrase from an RSS pubDate, alongside the exact date which is
// always stated as given. Empty when the date will not parse.
function relTime(pubDate) {
  const t = Date.parse(pubDate || '');
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 0) return '';
  if (mins < 2) return 'just now';
  if (mins < 60) return `about ${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `about ${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
function pubUnix(pubDate, given) {
  if (Number.isFinite(given)) return given;
  const t = Date.parse(pubDate || '');
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}

async function fetchText(url, timeoutMs = 7000) {
  const r = await fetch(url, {
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'user-agent': UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.text();
}
async function fetchJson(url, timeoutMs = 5000) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
}
// The answer is two parts: one plain sentence naming the leading article, then Readings
// listing every headline behind it with its source and date at full precision. Dates are
// the source's own pubDate string, stated verbatim.
function buildAnswer(items, opt) {
  const top = items[0];
  const rel = relTime(top.pubDate);
  const recent = rel ? ` (${rel})` : '';
  const t0 = cleanTitle(top.title, top.source);
  const src0 = top.source || 'an unnamed source';
  const note0 = top.note ? ` (${top.note})` : '';
  let lead;
  if (opt.offTopic) {
    // Nothing in the pool was about the topic asked for. Saying so and naming what is there is
    // the truthful answer; presenting an unrelated story as the topic's top headline is not.
    lead = `No current article on "${opt.label}" was found in the licensed feeds read here. `
      + `The latest story available is "${t0}" from ${src0}${note0}`;
  } else if (opt.mode === 'headlines') {
    lead = opt.label === 'top stories'
      ? `The top story right now is "${t0}" from ${src0}${note0}`
      : `The top ${opt.label} headline right now is "${t0}" from ${src0}${note0}`;
  } else {
    lead = `The top match for "${opt.label}" is "${t0}" from ${src0}${note0}`;
  }
  const sentence = `${lead}, published ${top.pubDate}${recent}.`;
  const list = items.slice(0, 5).map((it, i) => {
    const t = cleanTitle(it.title, it.source);
    const s = it.source || 'unknown source';
    const n = it.note ? ` (${it.note})` : '';
    const u = opt.includeUrl && it.link ? ` (${it.link})` : '';
    return `(${i + 1}) "${t}" from ${s}${n}${u}, published ${it.pubDate}`;
  }).join('; ');
  const summary = sentence;
  const readings = `${list}.`;
  const articles = items.slice(0, 5).map((it) => ({
    title: cleanTitle(it.title, it.source), source: it.source || null,
    url: it.link || null, published_at: it.pubDate || null,
    ...(it.points != null ? { points: it.points } : {}),
    ...(it.num_comments != null ? { comments: it.num_comments } : {}),
  }));
  const body = {
    intent: opt.intent,
    headline: t0, source: top.source || null, url: top.link || null,
    published_at: top.pubDate || null, published_unix: pubUnix(top.pubDate, top.published_unix),
    result_count: articles.length, articles, summary, readings,
    confidence: opt.confidence, source_feed: opt.feed, as_of: new Date().toISOString(),
  };
  body[opt.mode === 'headlines' ? 'topic' : 'query'] = opt.label;
  return body;
}
function noResults(intent, key, label, feed) {
  const noun = intent === 'NEWS_HEADLINES' ? 'headlines were' : 'articles were';
  const body = {
    intent, headline: null, source: null, url: null, published_at: null,
    published_unix: 0, result_count: 0, articles: [],
    summary: `No current news ${noun} found for "${label}".`,
    confidence: 0.9, source_feed: feed, as_of: new Date().toISOString(),
  };
  body[key] = label;
  return body;
}

function sortRecent(items) {
  return items.slice().sort((a, b) => pubUnix(b.pubDate) - pubUnix(a.pubDate));
}
// An RSS or Atom feed, parsed without a library: item or entry blocks by regex, then the title,
// the link and the date out of each. Both shapes appear across these three feeds.
function feedItems(xml, sourceName) {
  const blocks = String(xml).match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  return blocks.map((b) => {
    const pick = (tag) => {
      const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(b);
      return m ? clean(m[1].replace(/<[^>]+>/g, ' ')) : null;
    };
    // Atom links carry the URL in an href attribute rather than as element text.
    const href = /<link\b[^>]*href="([^"]+)"/i.exec(b);
    const date = pick('pubDate') || pick('published') || pick('updated') || pick('dc:date');
    const author = pick('dc:creator') || pick('author') || pick('name');
    return {
      title: pick('title'),
      link: href ? href[1] : pick('link'),
      source: sourceName,
      author: author && author !== sourceName ? author : null,
      pubDate: date,
      published_unix: date && Number.isFinite(Date.parse(date)) ? Math.floor(Date.parse(date) / 1000) : 0,
      description: (pick('description') || pick('summary') || '').slice(0, 300) || null,
    };
  }).filter((x) => x.title);
}

async function feedArticles(url, sourceName, timeoutMs = 7000) {
  const xml = await fetchText(url, timeoutMs);
  return feedItems(xml, sourceName);
}

// Wikinews articles, CC BY 4.0, newest first. The category listing gives the titles and the
// intro text in one call, which is enough for a headline answer and needs no scraping.
async function wikinewsArticles(query) {
  const base = `${WIKINEWS}?action=query&format=json&formatversion=2&prop=extracts`
    + '&exintro=1&explaintext=1&exlimit=5';
  const url = query
    ? `${base}&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrsort=create_timestamp_desc&gsrlimit=5`
    : `${base}&generator=categorymembers&gcmtitle=Category:Published&gcmsort=timestamp&gcmdir=desc&gcmlimit=5`;
  const d = await fetchJson(url, 8000);
  return (((d.query || {}).pages) || []).map((p) => ({
    title: clean(p.title || ''),
    link: p.title ? `https://en.wikinews.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}` : null,
    source: 'Wikinews',
    author: null,
    // A Wikinews article opens with its own dateline, which is the publication date.
    pubDate: datelineOf(p.extract),
    published_unix: datelineOf(p.extract) ? Math.floor(Date.parse(datelineOf(p.extract)) / 1000) : 0,
    description: clean(String(p.extract || '').split('\n').slice(1).join(' ')).slice(0, 300) || null,
  })).filter((x) => x.title);
}
function datelineOf(extract) {
  const first = String(extract || '').split('\n')[0].trim();
  const t = Date.parse(first);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// Every word that means the topic, so a category word finds the subject rather than only its own
// spelling: a "technology" question is answered by an article about digital policy or software,
// which is what the feeds actually call it.
const SYNONYMS = {
  technology: ['tech', 'digital', 'software', 'computing', 'internet', 'ai', 'artificial intelligence', 'chip', 'semiconductor', 'robot'],
  business: ['economy', 'economic', 'trade', 'market', 'industry', 'commerce', 'finance', 'investment'],
  politics: ['government', 'election', 'parliament', 'minister', 'president', 'policy', 'summit'],
  science: ['research', 'study', 'scientist', 'discovery', 'climate', 'space', 'physics', 'biology'],
  health: ['medical', 'medicine', 'disease', 'hospital', 'patient', 'vaccine', 'outbreak'],
  world: ['international', 'global', 'foreign', 'nation', 'country'],
  entertainment: ['film', 'music', 'culture', 'art', 'festival', 'theatre'],
  education: ['school', 'university', 'student', 'teacher', 'learning'],
  sport: ['match', 'tournament', 'championship', 'olympic', 'player'],
};
function topicTerms(topic) {
  const t = String(topic).toLowerCase().trim();
  const terms = new Set([t]);
  for (const w of t.split(/\s+/)) if (w.length > 3) terms.add(w);
  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (t === key || t.includes(key) || syns.includes(t)) {
      terms.add(key);
      for (const s of syns) terms.add(s);
    }
  }
  return [...terms];
}
// Which of the pooled items are about the topic asked for. A term matches as a whole word, not as
// a substring: "ai" inside "Haiti" made a displacement story read as technology news.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matchTopic(items, topic) {
  if (!topic) return items;
  const res = topicTerms(topic).map((w) => new RegExp(`\\b${escapeRe(w)}\\b`, 'i'));
  const inTitle = [];
  const inBody = [];
  for (const it of items) {
    if (res.some((re) => re.test(it.title))) inTitle.push(it);
    else if (res.some((re) => re.test(it.description || ''))) inBody.push(it);
  }
  // Title matches first: an article whose own headline is about the topic is the one to name.
  return [...sortRecent(inTitle), ...sortRecent(inBody)];
}

// All three sources are read in parallel and pooled, freshest first, then filtered on the topic.
// Pooling rather than falling back matters: each feed is narrow on its own (Global Voices is
// global civic reporting, NASA is spaceflight, Wikinews is volunteer-written), so a topic is far
// more likely to be covered by one of them than by any single one.
async function newsFor(query, intent, label) {
  // Wikinews is searched for the topic and, when the topic is a category word, for its synonyms
  // too. A category question is otherwise a coin flip on what the four feeds happened to publish
  // today, and searching is what makes it answerable.
  const searches = query ? [...new Set([query, ...topicTerms(query).slice(0, 4)])].slice(0, 3) : [null];
  const [gv, na, ec, gov1, gov2, gov3, ...wns] = await Promise.all([
    feedArticles(GLOBALVOICES, 'Global Voices').catch(() => []),
    feedArticles(NASA, 'NASA').catch(() => []),
    feedArticles(EC_PRESS, 'European Commission').catch(() => []),
    ...US_GOV_FEEDS.map(([u, name]) => feedArticles(u, name).catch(() => [])),
    ...searches.map((s) => wikinewsArticles(s).catch(() => [])),
  ]);
  const gov = [...gov1, ...gov2, ...gov3];
  const seen = new Set();
  const wn = wns.flat().filter((it) => {
    if (seen.has(it.title)) return false;
    seen.add(it.title);
    return true;
  });
  const pool = sortRecent([...gv, ...wn, ...na, ...ec, ...gov]);
  // A headline question asks what is in the news now, so an archive article is a wrong answer
  // however well it matches the words. A search question is free to reach further back.
  const FORTNIGHT = 14 * 86400;
  const nowUnix = Math.floor(Date.now() / 1000);
  const fresh = intent === 'NEWS_HEADLINES'
    ? pool.filter((it) => it.published_unix && nowUnix - it.published_unix <= FORTNIGHT)
    : pool;
  const hits = matchTopic(fresh, query);
  const items = hits.length ? hits : fresh;
  const mode = intent === 'NEWS_HEADLINES' ? 'headlines' : 'search';
  if (!items.length) {
    return noResults(intent, mode === 'headlines' ? 'topic' : 'query', label,
      LICENSED_FEEDS);
  }
  const used = [...new Set(items.slice(0, 5).map((it) => it.source))];
  const credits = [];
  if (used.includes('Global Voices')) credits.push(CREDIT_GV);
  if (used.includes('Wikinews')) credits.push(CREDIT_WIKINEWS);
  if (used.includes('NASA')) credits.push(CREDIT_NASA);
  if (used.includes('European Commission')) credits.push(CREDIT_EC);
  if (used.some((s) => US_GOV_FEEDS.some(([, name]) => name === s))) credits.push(CREDIT_USGOV);
  const body = buildAnswer(items, {
    intent, mode, label, feed: used.join(', '), includeUrl: mode === 'search',
    confidence: hits.length ? 0.94 : 0.7,
    offTopic: !hits.length && !!query,
  });
  body.attribution = credits.join(' ');
  body.on_topic = hits.length > 0;
  return body;
}

async function getHeadlines(topic) {
  const label = topic ? topic : 'top stories';
  // A bare category word is a thin query, so a synonym is added to broaden it.
  const cat = topic ? CATEGORY[topic.toLowerCase().trim()] : null;
  const query = topic ? (cat && cat !== topic.toLowerCase() ? `${topic} OR ${cat}` : topic) : '';
  return newsFor(query, 'NEWS_HEADLINES', label);
}

async function searchNews(query) {
  return newsFor(query, 'NEWS_SEARCH', query);
}

const json = (body, status = 200, ttl = 0) =>
  new Response(JSON.stringify(body, null, 1), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl ? `public, max-age=${ttl}` : 'no-store',
      'access-control-allow-origin': '*',
    },
  });

const MEMO = new Map();
const MEMO_TTL_MS = 10_000;
const RECENT = [];

async function memoized(key, fn) {
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.body;
  const body = await fn();
  MEMO.set(key, { at: Date.now(), body });
  return body;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const q = url.searchParams;

    if (path === '/__last') return json({ recent: RECENT.slice(-25) });
    if (path === '/health') return json({ ok: true, intents: ['NEWS_HEADLINES', 'NEWS_SEARCH'] });

    RECENT.push({ at: new Date().toISOString(), method: request.method, url: request.url,
      ua: request.headers.get('user-agent'),
      via: request.headers.get('x-telegraph-node') || request.headers.get('x-forwarded-for') });
    if (RECENT.length > 50) RECENT.shift();

    if (path === '/') {
      return json({
        service: 'Telegraph news miner',
        intents: {
          NEWS_HEADLINES: '/headlines/{topic} or /headlines?topic=',
          NEWS_SEARCH: '/news/{query} or /news?q=',
        },
        sources: 'Global Voices (CC BY 3.0), Wikinews (CC BY 4.0), the European Commission '
          + '(CC BY 4.0), NASA, NIST, the NSF and the US Department of Energy (US Government, no '
          + 'copyright). All keyless.',
      });
    }
    // NEWS_HEADLINES: current headlines for a topic or category. A whole question, a topic in
    // the path or a topic query param all resolve, and no topic at all pools the feeds and
    // returns the freshest story across them.
    if (path === '/headlines' || path.startsWith('/headlines/')) {
      const raw = path.startsWith('/headlines/')
        ? decodeURIComponent(path.slice('/headlines/'.length))
        : (q.get('question') || q.get('query') || q.get('topic') || q.get('category') || q.get('q'));
      const topic = extractTerm(raw, HL_HAS, HL_ALL);
      try {
        const body = await memoized(`h:${(topic || 'top').toLowerCase()}`, () => getHeadlines(topic));
        return json(body, 200, 10);
      } catch (err) {
        return json(noResults('NEWS_HEADLINES', 'topic', topic || 'top stories', LICENSED_FEEDS), 200, 10);
      }
    }

    // NEWS_SEARCH: the most relevant article for a query, across every licensed feed plus a
    // Wikinews search on the query itself. Unlike the headline route this one may reach past the
    // last fortnight, because a search is not a question about today. An empty query defaults to
    // "technology".
    if (path === '/news' || path.startsWith('/news/')) {
      const raw = path.startsWith('/news/')
        ? decodeURIComponent(path.slice('/news/'.length))
        : (q.get('question') || q.get('query') || q.get('q') || q.get('search'));
      const query = extractTerm(raw, NS_HAS, NS_ALL) || 'technology';
      try {
        const body = await memoized(`s:${query.toLowerCase()}`, () => searchNews(query));
        return json(body, 200, 10);
      } catch (err) {
        return json(noResults('NEWS_SEARCH', 'query', query || 'technology', LICENSED_FEEDS), 200, 10);
      }
    }

    return json({ error: 'not found', usage: '/headlines?category=technology or /news?q=<query>' }, 404);
  },
};
