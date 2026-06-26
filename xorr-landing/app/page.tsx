import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Announcement from "@/components/Announcement";
import Features from "@/components/Features";
import Partners from "@/components/Partners";
import TokenBanner from "@/components/TokenBanner";
import FollowAlong from "@/components/FollowAlong";
import CtaBanner from "@/components/CtaBanner";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "XORR",
  applicationCategory: "FinanceApplication",
  description:
    "A zero-knowledge USDC wallet on Stellar. Shield your balance, pay privately, bridge from Ethereum, and earn or borrow — every spend proven in zero knowledge and verified on-chain.",
  operatingSystem: "Web",
  offers: { "@type": "Offer", category: "Private DeFi" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SmoothScroll>
        <main className="min-h-screen">
          <Navbar />
          <Hero />
          <Announcement />
          <Features />
          <Partners />
          <TokenBanner />
          <FollowAlong />
          <CtaBanner />
          <Footer />
        </main>
      </SmoothScroll>
    </>
  );
}
