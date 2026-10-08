import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StoreProvider } from "@/components/store";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtliQ Sales and CRM Assistant",
  description: "Grounded commitment ledger, daily brief and approval-gated CRM proposals for AtliQ's sellers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <TopBar />
          <main className="shell">
            {children}
            <footer>
              Prototype over the synthetic AtliQ dataset. Reference date: Friday 10 July 2026. Sales and CRM Assistant never sends
              anything to a client and never writes to the CRM without a seller&apos;s approval.
            </footer>
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
