// Static citations. Each quote was copied from the primary page on the retrieval date shown.
const SOURCES = [
  {
    publisher: "Chainalysis",
    title: "Introducing Chainalysis Operation Spincaster: An Ecosystem-Wide Initiative To Disrupt and Prevent Billions in Losses to Crypto Scams",
    date: "July 18, 2024",
    url: "https://www.chainalysis.com/blog/operation-spincaster/",
    quotes: [
      "our data now reveals that over USD $2.7 billion has been lost to approval phishing",
      "the scammer tricks the user into signing a malicious blockchain transaction that gives the scammer’s address approval to spend specific tokens inside the victim’s wallet",
    ],
    scope: "Scope: losses attributed to approval phishing since May 2021, per the article. Method: the publisher's own on-chain address attribution; the figure is an estimate and the underlying address set is not published in the article.",
    relevance: "Relevance: standing token approvals are the mechanism the excess-allowance case in section 2 exercises on a local test chain.",
  },
  {
    publisher: "OWASP Cheat Sheet Series",
    title: "Transaction Authorization Cheat Sheet",
    date: "living document, no publication date on the page",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html",
    quotes: [
      "All significant transaction data must be verified by the user, generated and stored on a server, then passed to an authorization component without any possibility of tampering by the client.",
      "To prevent multiple replay attacks, each set of authorization credentials should be unique for every operation.",
    ],
    scope: "Scope: implementation guidance for transaction authorization in banking-style applications. Method: community-maintained guidance, not a measurement study; it contains no loss figures.",
    relevance: "Relevance: the recipient, amount and replay cases in section 2 correspond to these two requirements.",
  },
] as const;

export function Research() {
  return (
    <section className="rounded-[20px] border border-line bg-surface p-6" aria-labelledby="ev-res">
      <h2 id="ev-res" className="text-lg font-semibold tracking-tight">3 · Cybersecurity research</h2>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-amber">
        The figures below are real-world figures published by third parties. They are unrelated to the simulated funds above. CounterSign is not claimed to have been able to prevent these losses.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {SOURCES.map((s) => (
          <article key={s.url} className="rounded-[16px] border border-line bg-white/5 p-4">
            <p className="text-[10px] tracking-widest text-muted uppercase">{s.publisher} · {s.date}</p>
            <h3 className="mt-1 text-sm leading-snug font-medium">{s.title}</h3>
            {s.quotes.map((q) => <blockquote key={q} className="mt-3 border-s-2 border-line ps-3 text-xs leading-relaxed text-fg">“{q}”</blockquote>)}
            <p className="mt-3 text-[11px] leading-snug text-muted">{s.scope}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{s.relevance}</p>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="ident mt-3 block text-[11px] text-muted underline">{s.url}</a>
            <p className="mt-1 font-mono text-[10px] text-muted">Quotes retrieved from the primary page 2026-11-21.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
