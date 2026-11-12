'use client';
import { useEffect, useRef, useState } from 'react';

/*
 * Telr's card fields (IFZA's payment gateway) on /pay/<ref>. IFZA's guide, "Load the Telr SDK":
 * the SDK comes from Telr's server (a payment-security requirement, it can't be bundled), init with
 * the telr_init IFZA gave for this payment, tokenize() gives a one-time card token. The card
 * details stay in Telr's frame: only the token goes to our server (app/api/pay), which checks the
 * payment out at IFZA and answers the bank's check (3-D Secure) to show in a frame. That check
 * returns to /shop/return/<ref>: inside the frame it tells this page with postMessage (IFZA's guide,
 * "Your return page"), and this page asks our server for the status (app/api/pay/status), then
 * opens the result page. A bank that leaves the frame returns as the whole page instead.
 */
const SDK = 'https://secure.telr.com/jssdk/v2/telr_sdk.js';

type TelrSdk = { init(options: Record<string, unknown>): void; tokenize(): Promise<string> };
declare global { interface Window { telrSdk?: TelrSdk } }

// the SDK once per page, also when this component mounts twice
function loadSdk(): Promise<TelrSdk> {
  if (window.telrSdk) return Promise.resolve(window.telrSdk);
  return new Promise(function (resolve, reject) {
    let s = document.querySelector<HTMLScriptElement>('script[src="' + SDK + '"]');
    if (!s) {
      s = document.createElement('script');
      s.src = SDK;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', function () { if (window.telrSdk) resolve(window.telrSdk); else reject(new Error('no telrSdk')); });
    s.addEventListener('error', function () { reject(new Error('the card form could not be loaded')); });
  });
}

// the return page's message (lib/shop/http.ts RETURN_MESSAGE)
const RETURN_MESSAGE = 'cj300-payment-return';

const RETRY_LATER = 'The card form couldn’t be loaded. Please check your connection and reload this page. You have not been charged.';

export default function CardPayment({ orderRef, init, total }: { orderRef: string; init: Record<string, unknown>; total: string }) {
  const fields = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [over, setOver] = useState(false); // this payment can't be used again: start again
  const [bank, setBank] = useState('');
  const bankFrame = useRef<HTMLIFrameElement>(null);

  // the bank check's return page, in our frame, says the buyer is back: ask our server, then go
  useEffect(function () {
    if (!bank) return;
    let done = false;
    function onMessage(e: MessageEvent) {
      // only this site's own pages (the return page) can send with this origin
      if (done || e.origin !== location.origin || !bankFrame.current) return;
      let data: { type?: string; ref?: string } = {};
      try { data = typeof e.data === 'string' ? JSON.parse(e.data) : {}; } catch { return; }
      if (data.type !== RETURN_MESSAGE || data.ref !== orderRef) return;
      done = true;
      fetch('/api/pay/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: orderRef }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) { location.href = d.page || '/payment/pending?orderid=' + encodeURIComponent(orderRef); })
        .catch(function () { location.href = '/payment/pending?orderid=' + encodeURIComponent(orderRef); });
    }
    window.addEventListener('message', onMessage);
    return function () { window.removeEventListener('message', onMessage); };
  }, [bank, orderRef]);

  useEffect(function () {
    let gone = false;
    loadSdk().then(function (sdk) {
      const el = fields.current;
      if (gone || !el) return;
      // init once per card form: each init adds a listener in the SDK
      if (el.dataset.ready !== '1') {
        el.dataset.ready = '1';
        sdk.init(Object.assign({}, init, { appearance: { labels: 1, theme: 'light', logos: 1, borders: 1, dropdowns: 0 } }));
      }
      setReady(true);
    }).catch(function () { if (!gone) setMsg(RETRY_LATER); });
    return function () { gone = true; };
  }, [init]);

  function pay() {
    const sdk = window.telrSdk;
    if (!sdk || busy) return;
    setMsg('');
    setBusy(true);
    sdk.tokenize()
      .then(function (token) {
        return fetch('/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: orderRef, token }) })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (data) {
            if (data.orderUrl) { setBank(data.orderUrl); return; }
            if (data.page) { location.href = data.page; return; }
            setBusy(false);
            setMsg(data.error || 'We couldn’t complete the payment. Please try again.');
            if (data.retry === false) setOver(true);
          });
      }, function () {
        // the SDK rejects with a text when the card details are incomplete
        setBusy(false);
        setMsg('Please enter your complete card details.');
      })
      .catch(function () {
        setBusy(false);
        setMsg('We couldn’t reach the payment service. You have not been charged. Please try again in a moment.');
      });
  }

  if (bank) {
    return (
      <div className="card-pay">
        <p className="note">Confirm the payment with your bank below. Please don’t close or refresh this page.</p>
        <iframe
          ref={bankFrame}
          className="bank-check"
          src={bank}
          title="Payment confirmation by your bank"
          sandbox="allow-forms allow-modals allow-popups-to-escape-sandbox allow-popups allow-scripts allow-top-navigation allow-same-origin"
        />
      </div>
    );
  }

  return (
    <div className="card-pay">
      <div className="card-fields" aria-busy={!ready}>
        {/* Telr puts its card fields here (the id is the SDK's) */}
        <div id="telr_frame" ref={fields}></div>
        {!ready && !msg && <p className="card-loading" role="status">Loading the secure card form…</p>}
      </div>
      <p className="alert error" role="alert" hidden={!msg}>{msg}</p>
      <div className="actions">
        {over
          ? <a className="btn" href={'/shop/retry/' + encodeURIComponent(orderRef)}>Start again</a>
          : <button className="btn" type="button" onClick={pay} disabled={!ready || busy}>{busy ? 'Processing…' : 'Pay ' + total}</button>}
      </div>
      <p className="note">Card details are entered in our payment provider’s secure form and never reach our servers. Ticket confirmation is sent by email after payment.</p>
    </div>
  );
}
