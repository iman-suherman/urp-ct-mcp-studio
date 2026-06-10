import type { Metadata } from "next";
import { InstallGuide } from "@/components/InstallGuide";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Install in VS Code · ${BRAND_NAME}`,
  description:
    "Step-by-step guide to download and install Commerce MCP Studio in VS Code from a VSIX package.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
