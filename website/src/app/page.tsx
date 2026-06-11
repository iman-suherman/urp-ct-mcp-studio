import { CtaBanner } from "@/components/CtaBanner";
import { DeveloperFriendly } from "@/components/DeveloperFriendly";
import { SecureByDesign } from "@/components/SecureByDesign";
import { Hero } from "@/components/Hero";
import { VersionHistoryShowcase } from "@/components/VersionHistoryShowcase";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SecureByDesign />
      <DeveloperFriendly />
      <VersionHistoryShowcase />
      <CtaBanner />
    </>
  );
}
