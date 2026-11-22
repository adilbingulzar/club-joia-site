import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav, { Footer, Lockup } from '@/components/SiteNav';
import Countdown from '@/components/Countdown';
import Slideshow from '@/components/Slideshow';
import { CJ_CONFIG as cfg } from '@/lib/config';
import Price from '@/components/Price';
import GalleryVideo from '@/components/GalleryVideo';

export const metadata: Metadata = {
  title: 'Club JOIA 300 | Abu Dhabi Grand Prix, December 4, 5 & 6',
  description: 'Club JOIA 300: the exclusive trackside mega yacht experience at the Abu Dhabi Grand Prix, December 4, 5 & 6. Open bar, fine dining, DJs and track views.'
};

// Previous editions: a highlights film and four photos a year (public/assets/gallery/<year>/)
const GALLERY: { year: string; photos: string[] }[] = [
  { year: '2025', photos: ['Two guests with champagne on deck at sunset, Yas Marina Circuit behind them', 'Canapés served in coupe glasses', 'Guests boarding the yacht along the lit gangway at night', 'Guests watching a Formula One car pass on track at sunset'] },
  { year: '2024', photos: ['Chef finishing seared salmon skewers', 'A guest dancing on board at night', 'DJ performing on deck at night', 'Guests dancing with champagne at the after-party'] }
];

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
        <Slideshow />
        <div className="wrap" style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 2 }}>
          <SiteNav cta={{ href: '/tickets', label: 'Get your access', badge: true }} />
          <div className="hero-body" id="top">
            <div>
              <h1>3rd year edition of the exclusive trackside mega yacht experience at the Abu Dhabi Grand Prix.</h1>
              <p className="when">Abu Dhabi Grand Prix &nbsp;|&nbsp; <span>December 4, 5 &amp; 6</span></p>
              <p className="avail">Full weekend mega yacht experience</p>
              <ul className="tiers hero-tiers">
                {tiers.map(function (t) {
                  return <li key={t.id}><Link href={t.page}><i className={'sw ' + t.swatch}></i><b>{t.name}</b><span><Price tier={t.id} pkg="3-days" /></span></Link></li>;
                })}
              </ul>
              <p className="hero-note">Prices for 3-day access. Saturday and Sunday day access also available.</p>
              <div className="btns">
                <Link className="btn" href="/tickets">Book your access</Link>
                <span className="ltd">Limited availability</span>
              </div>
            </div>
          </div>
          <div className="hero-foot">
            <a className="more" href="#more-info"><span>More info</span>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg></a>
            <div className="strip">
              <div className="countdown"><b className="kicker">Trackside yacht access</b>
                <Countdown />
              </div>
              <div className="featuring"><span>Featuring</span>
                <div className="artists">
                  <p><b>Black Coffee</b><small>The Grammy-winning house music icon</small></p>
                  <p><b>Gordo</b><small>A global force in afro house music</small></p>
                </div>
              </div>
              <div className="catering"><span>Catering by</span><img src="/assets/img/robertos.png" alt="Roberto’s" /><small>The best homegrown Italian fine dining restaurant</small></div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="more-info">
          <div className="wrap about">
            <div>
              <h2>A yacht club on the water, a front-row seat to race weekend</h2>
              <p>Club JOIA 300 brings luxury yacht access to the Abu Dhabi Grand Prix. Spend race weekend aboard JOIA, a 65 m mega yacht at Yas Marina, from the afternoon sessions to the sunset over the marina and on into the night, with the cars passing just metres away.</p>
              <p>Expect a private, invite-style atmosphere: live sets from Black Coffee and Gordo, dining by Roberto’s and an easy, elegant crowd. Access is limited, so book early.</p>
              <div className="about-photos">
                <figure className="ap-main"><img src="/assets/img/yacht/side-aerial.webp" alt="JOIA, a 65 m mega yacht, at sea at sunset with its sundeck and jacuzzi deck in view" width="1672" height="941" loading="lazy" /><figcaption>JOIA, The Crown Jewel</figcaption></figure>
                <figure><img src="/assets/img/yacht/lounge-deck.webp" alt="Open-air lounge deck with teak floors, sofas and a jacuzzi facing the sea" width="1672" height="941" loading="lazy" /><figcaption>Lounge deck</figcaption></figure>
                <figure><img src="/assets/img/yacht/deck-bar.webp" alt="Deck bar with stools and a stainless steel staircase at sunset" width="1672" height="941" loading="lazy" /><figcaption>Deck bar</figcaption></figure>
              </div>
            </div>
            <dl className="facts">
              <div><dt>Event</dt><dd>Abu Dhabi Grand Prix</dd></div>
              <div><dt>Dates</dt><dd>Friday December 4, Saturday December 5 and Sunday December 6</dd></div>
              <div><dt>Yacht</dt><dd>JOIA, a 65 m mega yacht</dd></div>
              <div><dt>Venue</dt><dd>Yas Marina Circuit, Abu Dhabi</dd></div>
              <div><dt>Hours</dt><dd>Friday 2pm to 10pm. Saturday and Sunday 2pm to 2am</dd></div>
              <div><dt>Music</dt><dd>Featuring Black Coffee and Gordo</dd></div>
              <div><dt>Dining</dt><dd>Catering by Roberto’s</dd></div>
              <div><dt>Dress code</dt><dd>Smart elegant</dd></div>
              <div><dt>Guests</dt><dd>300 each day, aged 21 and over</dd></div>
              <div><dt>Tickets</dt><dd>Limited. Sales close December 3. <Link href="/tickets">Book online</Link></dd></div>
            </dl>
          </div>
        </section>

        <section className="lineup" id="entertainment">
          <div className="wrap">
            <div className="lineup-head">
              <div>
                <p className="eyebrow">Entertainment</p>
                <h2>Three days of electric energy.<br />World-class DJ line-up.<br />One extraordinary Sundeck.</h2>
              </div>
              <div className="btns">
                <Link className="btn" href="/tickets">Book your access</Link>
                <span className="ltd">Limited availability</span>
              </div>
            </div>
            <div className="lineup-lead">
              <p>Experience two exceptional headline performances by Black Coffee and Gordo on the Sundeck at Club JOIA 300, alongside an exciting line-up of local club star DJs throughout the weekend.</p>
              <p>Set against the backdrop of the Abu Dhabi Grand Prix, the Sundeck transforms into an exclusive setting for world-class music, bringing together an intimate crowd, premium drinks and an electric atmosphere from sun-soaked afternoons into the night. While this exceptional DJ line-up is stationed on the Sundeck, their sounds will be radiated throughout all remaining decks, distributing a unique Club JOIA 300 energy on our private mega yacht.</p>
              <p className="lineup-tag">Discover the music. Feel the energy. Be part of Club JOIA 300.</p>
            </div>
            <div className="artists-grid">
              <article className="artist">
                <figure><img src="/assets/img/artists/gordo.jpg" alt="Gordo in a black leather jacket and dark sunglasses" width="532" height="640" loading="lazy" /></figure>
                <small>Saturday, December 5 &nbsp;|&nbsp; Headliner · Live on the Sundeck</small>
                <h3>Gordo</h3>
                <p>Get ready for an electrifying Sundeck experience as Afro house powerhouse Gordo brings his signature high-energy beats and infectious rhythms to Club JOIA 300.</p>
              </article>
              <article className="artist">
                <figure><img src="/assets/img/artists/black-coffee.jpg" alt="Black Coffee seated in a pinstripe suit and black-rimmed glasses" width="799" height="1200" loading="lazy" style={{ objectPosition: '50% 30%' }} /></figure>
                <small>Sunday, December 6 &nbsp;|&nbsp; Headliner · Live on the Sundeck</small>
                <h3>Black Coffee</h3>
                <p>Experience Grammy Award-winning Black Coffee live on the Sundeck, bringing his signature blend of soulful rhythms and captivating Afro house beats to an unforgettable weekend finale.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="band" id="access">
          <div className="wrap">
            <h2>Choose your access</h2>
            <p style={{ color: 'var(--mute)', margin: 0, maxWidth: '60ch' }}>Three access levels, each available for all three days or as a single Saturday or Sunday.</p>
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

        <section id="gallery">
          <div className="wrap">
            <h2>Previous editions</h2>
            <p style={{ color: 'var(--mute)', margin: 0, maxWidth: '60ch' }}>Club JOIA 300 returns for its third year. A look back at race weekend on the water in 2025 and 2024.</p>
            {GALLERY.map(function (g) {
              const dir = '/assets/gallery/' + g.year + '/';
              return (
                <div key={g.year}>
                  <h3 className="gal-year">{g.year}</h3>
                  <div className="gallery">
                    <figure className="ph ph-video filled"><GalleryVideo src={dir + 'video.mp4'} poster={dir + 'poster.jpg'} label={g.year + ' highlights film'} /></figure>
                    {g.photos.map(function (alt, i) {
                      return <figure className="ph filled" key={i}><img src={dir + (i + 1) + '.jpg'} alt={alt} width="1000" height="1250" loading="lazy" /></figure>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="band" id="weekend">
          <div className="wrap">
            <h2>Race weekend on board</h2>
            <p style={{ color: 'var(--mute)', margin: 0, maxWidth: '60ch' }}>Doors open at 2pm each day. Open bar, Roberto’s dining and DJ sets run alongside the action on track.</p>
            <div className="trio">
              <article><small>Friday, December 4 &nbsp;|&nbsp; 2pm to 10pm</small><h3>Practice day</h3><p>The first two practice sessions. A relaxed first day to settle in on deck.</p></article>
              <article><small>Saturday, December 5 &nbsp;|&nbsp; 2pm to 2am</small><h3>Qualifying</h3><p>Final practice and the fight for pole, then after-race celebrations with a headline DJ until late.</p></article>
              <article><small>Sunday, December 6 &nbsp;|&nbsp; 2pm to 2am</small><h3>Race day</h3><p>The season finale, watched from the water, followed by after-race celebrations with a headline DJ until late.</p></article>
            </div>
          </div>
        </section>

        <section id="arrival">
          <div className="wrap arrival">
            <div>
              <h2>Arrival and entry</h2>
              <p style={{ color: 'var(--mute)', margin: 0, maxWidth: '60ch' }}>Everything you need on the day sits on your phone.</p>
              <ol className="steps">
                <li><small>01</small><div><h3>Your ticket in the app</h3><p>After booking you are invited to the Club JOIA 300 app. Activate your ticket before the event: it is your accreditation to the yacht for the weekend, with the full schedule at a glance.</p></div></li>
                <li><small>02</small><div><h3>Entry to Yas Marina</h3><p>Also download the official Abu Dhabi Grand Prix app, where you will find your QR code for entry to Yas Marina.</p></div></li>
                <li><small>03</small><div><h3>Getting there</h3><p>Pearly White includes shared chauffeur transfers. Ultra Black includes a dedicated driver or VIP parking. Ruby Red guests make their own way to Yas Marina.</p></div></li>
              </ol>
            </div>
            <figure className="phone-stage">
              <div className="phone">
                <div className="phone-screen">
                  <div className="phone-status" aria-hidden="true"><span>9:41</span><i className="island"></i><span className="phone-icons"><b></b><b></b><b></b></span></div>
                  <img src="/assets/img/app-home.jpg" alt="The Club JOIA 300 app home screen, showing a Pearly White membership card and shortcuts to ticket, programme, concierge and membership" width="780" height="1688" loading="lazy" />
                </div>
              </div>
              <figcaption>The Club JOIA 300 app</figcaption>
            </figure>
          </div>
        </section>

        <section className="band" id="corporate">
          <div className="wrap about">
            <div>
              <h2>Corporate and group hospitality</h2>
              <p>Club JOIA 300 is made for companies hosting clients, thanking their most valued customers or building new relationships in a setting they will remember.</p>
              <p>Corporate allocations are available for groups, for the full weekend, Saturday or Sunday, in any mix of access levels. Tell us your group size and dates and the team will put together a proposal.</p>
              <div className="btns" style={{ marginTop: '28px' }}>
                <a className="btn" href="mailto:access@clubjoia300.com?subject=Corporate%20allocation%20enquiry">Enquire about groups</a>
              </div>
            </div>
            <dl className="facts">
              <div><dt>For</dt><dd>Client hosting, customer rewards and team events</dd></div>
              <div><dt>Days</dt><dd>Full weekend, Saturday or Sunday</dd></div>
              <div><dt>Access</dt><dd>Ruby Red, Pearly White, Ultra Black or a mix</dd></div>
              <div><dt>Contact</dt><dd><a href="mailto:access@clubjoia300.com">access@clubjoia300.com</a></dd></div>
            </dl>
          </div>
        </section>

        <section className="faq">
          <div className="wrap" style={{ maxWidth: '820px' }}>
            <h2>Good to know</h2>
            <details><summary>How do I get access?</summary><p>Access is limited. Choose your access level, days and number on the <Link href="/tickets">access page</Link>, review your order summary, then pay securely online.</p></details>
            <details><summary>Which days can I attend?</summary><p>Club JOIA 300 runs on December 4, 5 and 6, during the Abu Dhabi Grand Prix weekend. Every access level is available for all three days, or as day access on Saturday (qualifying) or Sunday (race day). Friday is included with 3-day access.</p></details>
            <details><summary>What are the hours on board?</summary><p>Friday from 2pm to 10pm. Saturday and Sunday from 2pm to 2am, with after-race celebrations once the cars have finished.</p></details>
            <details><summary>Is there an age limit or dress code?</summary><p>Guests must be 21 or over. The dress code is smart elegant.</p></details>
            <details><summary>How do I receive my ticket?</summary><p>Once your booking is confirmed you are invited to the Club JOIA 300 app. Activate your ticket there before the event: it acts as your full accreditation to the yacht. You will also need the official Abu Dhabi Grand Prix app for your QR code to enter Yas Marina.</p></details>
            <details><summary>What drinks are included?</summary><p>Every access level includes an open bar throughout the event. Ultra Black guests also enjoy premium plus beverages during the after-party.</p></details>
            <details><summary>Is transport included?</summary><p>Chauffeur transfers are included with Pearly White (shared) and Ultra Black (a dedicated driver, or VIP parking if you prefer to drive).</p></details>
            <details><summary>Can my company book several places?</summary><p>Yes. Corporate allocations are available for companies hosting clients and teams. Email <a href="mailto:access@clubjoia300.com">access@clubjoia300.com</a> and the team will arrange the details.</p></details>
            <details><summary>What is the cancellation policy?</summary><p>Purchases can’t be refunded unless the event is cancelled by the organiser. If the organiser cancels due to circumstances beyond its control, a 20% administration fee is deducted.</p></details>
            <details><summary>When do sales close?</summary><p>Sales close on December 3, 2026, or earlier if places sell out.</p></details>
            <details><summary>Who is behind the event?</summary><p>Club JOIA 300 is presented by Elixium Events.</p></details>
            <details><summary>Who can I contact with a booking question?</summary><p>Send an email to <a href="mailto:access@clubjoia300.com">access@clubjoia300.com</a> and the team will get back to you.</p></details>
          </div>
        </section>

        <section className="apply">
          <div className="wrap">
            <Lockup className="flogo" /><p>Limited access available for December 4, 5 and 6.</p>
            <Link className="btn" href="/tickets">Book your access</Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
