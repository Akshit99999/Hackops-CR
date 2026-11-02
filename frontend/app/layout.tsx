import type { Metadata } from "next";
import { Shell } from "@/components/layout/Shell";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import "./design-system.css";

export const metadata: Metadata = {
  title: "Hackops — Your consumer command center",
  description:
    "Your purchases, your proof, your power. A consumer rights workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
