import { CtaBanner } from "@/components/CtaBanner";
import { ExtendWithEase } from "@/components/ExtendWithEase";
import { Features } from "@/components/Features";
import { SecureByDesign } from "@/components/SecureByDesign";
import { Hero } from "@/components/Hero";
import { VersionHistory } from "@/components/VersionHistory";

export default function HomePage() {
  return (
    <>
      <Hero />
      <VersionHistory />
      <ExtendWithEase />
      <SecureByDesign />
      <Features />
      <CtaBanner />
    </>
  );
}
