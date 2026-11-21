import type { Metadata } from "next";
import { Landing } from "@/components/marketing/Landing";

export const metadata: Metadata = {
  title: "CounterSign — One payment. Exactly as agreed.",
  description: "The customer approves one payment. CounterSign enforces the agreed recipient, amount and spending permissions. Demo environment: all funds are simulated or local test tokens.",
};

export default function LandingPage() {
  return <Landing />;
}
