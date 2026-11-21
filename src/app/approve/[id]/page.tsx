"use client";
// OWNER: worker B (w/mobile). Customer approval page. The pairing token arrives in the URL fragment.
import { useParams } from "next/navigation";
import { ApproveScreen } from "@/components/mobile/ApproveScreen";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ApproveScreen id={id} />;
}
