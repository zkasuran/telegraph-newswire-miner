# Data sources

Every figure this miner serves is a live read at request time. This file records, per source,
what it provides, what its own terms say about commercial use and redistribution, what credit it
requires and what its real rate limit is.

Two rules were followed in writing it. A licence is only recorded when the provider's own terms
page was read; where a page could not be read, that is stated as unverified rather than guessed.
And every source was called from a Cloudflare Worker before it went in, because several hosts
answer differently from a worker than from a laptop.

| Host | Provides | Licence | Commercial use | Attribution | Rate limit |
| --- | --- | --- | --- | --- | --- |
| globalvoices.org | Global civic reporting | CC BY 3.0 | Permitted in those words. | Required: "You must give appropriate credit, provide a link to the license, and indicate if changes were made." | No published limit on the feed. Read once per request, memoised for ten seconds. |
| en.wikinews.org | Volunteer-written news reports | CC BY 4.0 for anything published after 16 December 2024. | Permitted by CC BY 4.0. | Required, to Wikinews. | Standard Wikimedia API etiquette. Up to three search calls per uncached question. |
| ec.europa.eu | European Commission press releases | CC BY 4.0 | Permitted by CC BY 4.0. | Required, with changes indicated. | No published limit on the press-corner feed. |
| www.nasa.gov, www.nist.gov, www.nsf.gov, www.energy.gov | Science and technology news releases | No copyright: works of the United States Government. | Unrestricted. | Not required. Credited anyway. | No published limit on these feeds. |
| feeds.bbci.co.uk and feeds.npr.org | Formerly the headline source | No licence for reuse. | Barred. | Not applicable. | Not applicable. |

## Per source

### globalvoices.org

Global civic reporting.

What the terms say: "all content created by Global Voices is published under a Creative Commons Attribution-Only license"; reusers may "remix, transform, and build upon the material for any purpose, even commercially".

Commercial use: Permitted in those words.

Attribution: Required: "You must give appropriate credit, provide a link to the license, and indicate if changes were made."

Credit line published in every answer:

    Reporting from Global Voices, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).

Rate limit: No published limit on the feed. Read once per request, memoised for ten seconds.

Third-party photos in a story may carry other terms; only titles and dates are republished.

### en.wikinews.org

Volunteer-written news reports.

What the terms say: "Creative Commons Attribution 4.0 License"; material "may be attributed to \"Wikinews\"".

Commercial use: Permitted by CC BY 4.0.

Attribution: Required, to Wikinews.

Credit line published in every answer:

    Reporting from Wikinews, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

Rate limit: Standard Wikimedia API etiquette. Up to three search calls per uncached question.

Articles published before 16 December 2024 are CC BY 2.5, which is also attribution-only.

### ec.europa.eu

European Commission press releases.

What the terms say: "content owned by the EU on this website is licensed under the" "Creative Commons Attribution 4.0 International (CC BY 4.0)"; "reuse is allowed, provided appropriate credit is given and changes are indicated".

Commercial use: Permitted by CC BY 4.0.

Attribution: Required, with changes indicated.

Credit line published in every answer:

    Press releases (C) European Union, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), summarised here.

Rate limit: No published limit on the press-corner feed.

Logos and trade marks are excluded from the reuse policy and are not republished.

### www.nasa.gov, www.nist.gov, www.nsf.gov, www.energy.gov

Science and technology news releases.

Commercial use: Unrestricted.

Attribution: Not required. Credited anyway.

Credit line published in every answer:

    News releases from United States Government agencies, which carry no copyright.

Rate limit: No published limit on these feeds.

These four cover the technology and science categories the other sources are thin on. Agency logos and mission insignia have their own rules and are not republished.

### feeds.bbci.co.uk and feeds.npr.org

Formerly the headline source.

What the terms say: BBC Terms of Use 15a: "You're not allowed to pluck metadata from our content or RSS feeds". The NPR feed ships "Copyright 2024 NPR - For Personal Use Only".

Commercial use: Barred.

Attribution: Not applicable.

Rate limit: Not applicable.

Removed from the worker. Recorded so the change is auditable.

## Compliance

Met:

- globalvoices.org: the required credit line travels in every answer and in NOTICE.
- en.wikinews.org: the required credit line travels in every answer and in NOTICE.
- ec.europa.eu: the required credit line travels in every answer and in NOTICE.
- www.nasa.gov, www.nist.gov, www.nsf.gov, www.energy.gov: the required credit line travels in every answer and in NOTICE.

No open items: every source this miner calls permits the use, and every required credit line is published.
