import { JoiaLogo } from "@/member/components/joia/joia-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink">
      {/* Atmosphere: deep ruby glow + horizon line — evokes dusk over the marina without imagery. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-ruby/20 blur-[120px]" />
        <div className="absolute inset-x-0 top-[46%] h-px bg-gradient-to-r from-transparent via-pearl/15 to-transparent" />
      </div>
      <header className="safe-top relative z-10 flex justify-center px-6 pt-14">
        <JoiaLogo variant="color" width={168} priority />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">{children}</main>
      <footer className="safe-bottom relative z-10 px-6 pb-6 text-center text-[10px] uppercase tracking-[0.3em] text-pearl-dim">
        Private members club · By invitation only
      </footer>
    </div>
  );
}
