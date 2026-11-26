import { Suspense } from "react";
import { BottomNav, BottomNavFrame } from "@/member/components/member/bottom-nav";
import { MemberHeaderActions, MemberHeaderShell } from "@/member/components/member/member-header";
import type { Metadata, Viewport } from "next";
import { OfflineBanner } from "@/member/components/pwa/offline-banner";
import { ServiceWorkerRegistrar } from "@/member/components/pwa/service-worker-registrar";

// installable like the members app (public/member.webmanifest), with its own icon on the phone's home screen
export const metadata: Metadata = {
  manifest: "/member.webmanifest",
  applicationName: "CLUB JOIA 300",
  appleWebApp: { capable: true, title: "JOIA 300", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#ffffff" };

// The signed-in member's pages (club-joia-300-backend src/app/(member)/layout.tsx).
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-pearl focus:px-4 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <MemberHeaderShell>
        <Suspense fallback={<div className="skeleton size-9 rounded-full" aria-hidden />}>
          <MemberHeaderActions />
        </Suspense>
      </MemberHeaderShell>
      <OfflineBanner />
      <main id="main" className="mx-auto w-full max-w-lg px-5 pb-32 pt-6">
        {children}
      </main>
      <Suspense fallback={<BottomNavFrame pathname={null} />}>
        <BottomNav />
      </Suspense>
      <ServiceWorkerRegistrar />
    </div>
  );
}
