import { CtaBanner } from "@/components/CtaBanner";
import { DeveloperFriendly } from "@/components/DeveloperFriendly";
import { ExtendWithEase } from "@/components/ExtendWithEase";
import { SecureByDesign } from "@/components/SecureByDesign";
import { Hero } from "@/components/Hero";
import { VersionHistory } from "@/components/VersionHistory";
import { VersionHistoryShowcase } from "@/components/VersionHistoryShowcase";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ExtendWithEase />
      <SecureByDesign />
      <DeveloperFriendly />
      <VersionHistoryShowcase />
      <VersionHistory />
      <CtaBanner />
    </>
  );
}
