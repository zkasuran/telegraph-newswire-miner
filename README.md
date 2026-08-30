# NewsWire: keyless news headlines and search for Telegraph

Two Telegraph canonical intents, served by one Cloudflare Worker with no API key and no
database. Every headline is read live at request time from public feeds, so nothing can
silently go stale.

- **NEWS_HEADLINES**: top current headlines for a topic or category, from Google News RSS.
  Name a topic and it returns the single leading headline plus the next few. With no topic
  it returns top stories.
- **NEWS_SEARCH**: the most relevant recent article for a query. Google News RSS search is
  the primary source. The HackerNews Algolia API is a tech fallback for when Google News
  returns nothing.

Live: <https://telegraph-news.margyn.workers.dev>

```bash
curl -s "https://telegraph-news.margyn.workers.dev/headlines/bitcoin"
curl -s "https://telegraph-news.margyn.workers.dev/headlines?topic=technology"
curl -s "https://telegraph-news.margyn.workers.dev/news/ai%20regulation"
curl -s "https://telegraph-news.margyn.workers.dev/news?q=electric+vehicles"
```

## Quality first

A headline with its source and date is an objective fact, so the quality bar is to get it
right and state it clearly. Each summary is one plain sentence that answers the question,
the single leading article with its publisher and how recent it is, then a Readings block
listing the top five with source and date at the feed's own precision. Titles and dates are
reproduced verbatim from the source. Nothing is fabricated, nothing is cached beyond ten
seconds and nothing is padded to fit a scorer.

## How it answers

Built on the lessons the sibling sky and chain miners learned against the live node.

- **RSS parsed without a library.** `<item>` blocks are pulled with a regex, then
  `<title>`, `<link>`, `<pubDate>` and `<source>` out of each, with CDATA stripped and HTML
  entities decoded. Google News titles read "Headline - Publisher", so the clean `<source>`
  name is used to drop that trailing suffix.
- **A whole question resolves.** Every endpoint reads `?question=`, `?query=` and `?q=` as
  well as the structured parameter and the path form, so passing the whole question works.
- **An unfilled path template answers rather than errors.** The node probes declared paths
  with the template left in. A 400 on that probe reads as "miner did not respond" and
  freezes the miner out of routing for an epoch, so `/headlines/{topic}` resolves to top
  stories and `/news/{query}` resolves to technology, both at 200.
- **A ten second per-isolate memo.** A hot answer costs milliseconds, staleness bounded at
  the ten seconds the response advertises.
- **`/__last`** is a per-isolate ring buffer of recent requests, which is how the node's
  real call shape gets observed rather than guessed.

## Endpoints

| Path | Intent | Example |
| --- | --- | --- |
| `/headlines/{topic}` | NEWS_HEADLINES | `/headlines/bitcoin` |
| `/headlines?topic=` | NEWS_HEADLINES | `?topic=technology` |
| `/news/{query}` | NEWS_SEARCH | `/news/ai%20regulation` |
| `/news?q=` | NEWS_SEARCH | `?q=electric+vehicles` |
| `/health`, `/`, `/__last` | diagnostics | |

A topic is any subject or category; an empty topic returns top stories. A query is any
search phrase; an empty query defaults to technology.

## Sources

Every source publishes under a licence that grants a commercial service the right to republish
what it returns. That was the selection criterion, not convenience.

| Source | Licence | What it grants |
| --- | --- | --- |
| Global Voices | CC BY 3.0 | reuse "for any purpose, even commercially", with credit and a link |
| Wikinews | CC BY 4.0 | attribution-only, credited to Wikinews |
| European Commission | CC BY 4.0 | "reuse is allowed, provided appropriate credit is given and changes are indicated" |
| NASA, NIST, the NSF, the US Department of Energy | no copyright | works of the United States Government |

All six feeds are read in parallel and pooled rather than tried in order, because each is narrow on
its own: a topic is far likelier to be covered by one of six than by any single one. A headline
answer is then held to the last fortnight, since a question about what is in the news now is not
answered by an archive article however well it matches the words.

The publisher feeds this miner read before are gone for licence reasons, not technical ones:

- **BBC**: Terms of Use section 15a opens "You're not allowed to pluck metadata from our content or
  RSS feeds", which is exactly what parsing their RSS and republishing the titles is.
- **NPR**: the feed ships "Copyright 2024 NPR - For Personal Use Only".
- **Google News RSS**: answers 503 from a Cloudflare edge IP, and its terms bar the use anyway.
- **GDELT**: grants its data freely for any commercial use, which would have been ideal, but from
  this edge it returns 522 or 525 after 19 to 44 seconds, so it cannot answer a spot check.

The full record is in [`DATA-SOURCES.md`](DATA-SOURCES.md) and the credit lines are in
[`NOTICE`](NOTICE). Every credit also travels in the `attribution` field of each answer.

## Descriptors

Two miner descriptors, registered on-chain centrally by the operator:

- `newswire-headlines.yaml`, id 7328, intent NEWS_HEADLINES, path `/headlines`.
- `newswire-search.yaml`, id 7329, intent NEWS_SEARCH, path `/news`.

`signal_mapping.label_field` points at `summary`, the full natural sentence plus its
Readings block, which is the field the node scores.

## Layout

- `worker.js`: the whole miner, one Cloudflare Worker module.
- `newswire-headlines.yaml`, `newswire-search.yaml`: the two descriptors.
- `wrangler.toml`: deploy config, so deploy is a bare `wrangler deploy`.

## Deploy

```bash
wrangler deploy
```

No secrets and no bindings. The worker calls only public feeds, so there is nothing to
configure.

Written for the Telegraph network by [zkasuran](https://github.com/zkasuran) with AI
assistance (Claude, Anthropic). The design, review and verification were done by the author.

## Licence

MIT.
