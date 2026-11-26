import { JoiaLogo } from "@/member/components/joia/joia-logo";
import { OfflineProgramme } from "./offline-programme";

export const metadata = { title: "Offline" };

// The page the service worker (public/member-sw.js) shows when a member page can't load (club-joia-300-backend src/app/offline).

/**
 * Static offline fallback (pre-cached by the service worker). Shows the last cached public
 * programme — never personal data or QR credentials.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-ink px-5 py-12">
      <JoiaLogo variant="color" width={140} />
      <h1 className="display mt-10 text-5xl">You’re offline</h1>
      <p className="mt-3 text-sm text-pearl-muted">
        Your tickets need a connection to show a fresh secure QR code. If you’re at the venue, staff can also look up your ticket number. Here is the last programme saved on this device:
      </p>
      <OfflineProgramme />
    </main>
  );
}
