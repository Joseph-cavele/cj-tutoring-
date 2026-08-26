import type { Metadata, Viewport } from "next";
import { Caveat, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StudyAssistant from "@/components/ai/StudyAssistant";

// Display and body face from Design.md section 2.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Script accent, used sparingly for short phrases only.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "CJ Private Tutoring | Maths & Physical Science",
  description:
    "Online and in-person Maths and Physical Science tutoring for Grades 8-12.",
};

/**
 * viewportFit "cover" lets the page paint into the notch and home-indicator
 * areas, which is what gives env(safe-area-inset-*) a non-zero value for the
 * fixed chat launcher and the mobile nav panel to sit clear of.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", poppins.variable, caveat.variable)}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <StudyAssistant />
      </body>
    </html>
  );
}
