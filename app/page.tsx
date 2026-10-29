import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav, { Footer } from '@/components/SiteNav';
import Countdown from '@/components/Countdown';
import { CJ_CONFIG as cfg } from '@/lib/config';
import Price from '@/components/Price';

export const metadata: Metadata = { title: 'Club JOIA 300 | Abu Dhabi Grand Prix, December 4, 5 & 6' };

const tiers = cfg.tiers, all = tiers[tiers.length - 1].perks; // top tier holds every benefit

function CompareTable() {
  return (
    <table className="compare" id="compare-table">
      <caption className="sr-only">Benefits included in each access level</caption>
      <thead><tr><th scope="col"><span className="sr-only">Benefit</span></th>{tiers.map(function (t) {
        return <th scope="col" key={t.id}><Link href={t.page}><i className={'sw ' + t.swatch}></i>{t.name}</Link></th>;
      })}</tr></thead>
      <tbody>{all.map(function (perk) {
        return <tr key={perk}><th scope="row">{perk}</th>{tiers.map(function (t) {
          return <td key={t.id}>{t.perks.indexOf(perk) > -1
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" role="img" aria-label="Included"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            : <span className="dash" role="img" aria-label="Not included">&ndash;</span>}</td>;
        })}</tr>;
      })}</tbody>
      <tfoot><tr><th scope="row">3-day access</th>{tiers.map(function (t) {
        return <td key={t.id}><b><Price tier={t.id} pkg="3-days" /></b></td>;
      })}</tr><tr><th scope="row"><span className="sr-only">Book</span></th>{tiers.map(function (t) {
        return <td key={t.id}><Link className="btn-ghost sm" href={'/tickets#' + t.id}>Select</Link></td>;
      })}</tr></tfoot>
    </table>
  );
}

export default function Home() {
  return (
    <>
      <header className="hero">
        <img className="kv" alt="Guests on a yacht deck beside the Grand Prix circuit at sunset" src="/assets/img/hero.jpg" />
        <div className="wrap" style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 2 }}>
          <SiteNav cta={{ href: '/tickets', label: 'Get your access', badge: true }} />
          <div className="hero-body" id="top">
            <div>
              <h1>An exclusive trackside yacht experience at the Abu Dhabi Grand Prix.</h1>
              <p className="when">Abu Dhabi Grand Prix &nbsp;|&nbsp; <span>December 4, 5 &amp; 6</span></p>
              <p className="avail">Available access</p>
              <ul className="tiers hero-tiers">
                {tiers.map(function (t) {
                  return <li key={t.id}><Link href={t.page}><i className={'sw ' + t.swatch}></i><b>{t.name}</b><span><Price tier={t.id} pkg="3-days" /></span></Link></li>;
                })}
              </ul>
              <p className="hero-note">Prices for 3-day access. Two-day packages also available.</p>
              <div className="btns">
                <Link className="btn" href="/tickets">Book your access</Link>
                <span className="ltd">Limited availability</span>
              </div>
            </div>
          </div>
          <div className="hero-foot">
            <Countdown />
            <a className="more" href="#more-info"><span>More info</span>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg></a>
            <div className="strip">
              <div><b>Trackside yacht access</b></div>
              <div><span>Featuring</span><img src="/assets/img/afrojack.png" alt="AFROJACK" /></div>
              <div><span>Catering by</span><img src="/assets/img/robertos.png" alt="Roberto’s" /></div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="more-info">
          <div className="wrap about">
            <div>
              <h2>A yacht club on the water, a front-row seat to race weekend</h2>
              <p>Club JOIA 300 brings luxury yacht access to the Abu Dhabi Grand Prix. Spend three evenings on deck as the cars race past, with the sunset over the marina and the energy of the weekend all around you.</p>
              <p>Expect a private, invite-style atmosphere: a live set from AFROJACK, dining by Roberto’s and an easy, elegant crowd. Access is limited, so book early.</p>
            </div>
            <dl className="facts">
              <div><dt>Event</dt><dd>Abu Dhabi Grand Prix</dd></div>
              <div><dt>Dates</dt><dd>Friday December 4, Saturday December 5 and Sunday December 6</dd></div>
              <div><dt>Venue</dt><dd>Yas Marina Circuit, Abu Dhabi</dd></div>
              <div><dt>Music</dt><dd>Featuring AFROJACK</dd></div>
              <div><dt>Dining</dt><dd>Catering by Roberto’s</dd></div>
              <div><dt>Tickets</dt><dd>Limited. <Link href="/tickets">Book online</Link></dd></div>
            </dl>
          </div>
        </section>

        <section className="band" id="access">
          <div className="wrap">
            <h2>Choose your access</h2>
            <p style={{ color: 'var(--mute)', margin: 0, maxWidth: '60ch' }}>Three access levels, each available for all three days or as a two-day package.</p>
            <div className="access-cards">
              {tiers.map(function (t) {
                return <Link className="access-card" href={t.page} key={t.id}><img src={t.card} alt={t.name + ' membership card'} width="2000" height="1262" loading="lazy" /><b>{t.name}</b><small>{t.perks.length + ' benefits, 3 days '}<Price tier={t.id} pkg="3-days" /></small></Link>;
              })}
            </div>
          </div>
        </section>

        <section id="compare">
          <div className="wrap">
            <h2>Compare benefits</h2>
            <p style={{ color: 'var(--mute)', margin: 0, maxWidth: '60ch' }}>Every level includes the essentials. Each step up adds more comfort, service and privacy.</p>
            <div className="compare-scroll">
              <CompareTable />
            </div>
          </div>
        </section>

        <section className="faq">
          <div className="wrap" style={{ maxWidth: '820px' }}>
            <h2>Good to know</h2>
            <details><summary>How do I get access?</summary><p>Access is limited. Choose your access level, days and number on the <Link href="/tickets">access page</Link>, review your order summary, then pay securely online.</p></details>
            <details><summary>Which days can I attend?</summary><p>Club JOIA 300 runs on December 4, 5 and 6, during the Abu Dhabi Grand Prix weekend. Every access level is available for all three days, or as a two-day package: Saturday &amp; Sunday, Friday &amp; Sunday, or Friday &amp; Saturday.</p></details>
            <details><summary>Who is behind the event?</summary><p>Club JOIA 300 is presented by Elixium Events.</p></details>
          </div>
        </section>

        <section className="apply">
          <div className="wrap">
            <img className="flogo" src="/assets/img/logo.png" alt="Club JOIA 300" /><p>Limited access available for December 4, 5 and 6.</p>
            <Link className="btn" href="/tickets">Book your access</Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
