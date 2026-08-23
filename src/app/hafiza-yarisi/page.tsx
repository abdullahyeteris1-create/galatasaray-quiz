import type { Metadata } from "next";
import { MemoryRaceGame } from "@/components/memory/MemoryRaceGame";

export const metadata: Metadata = {
  title: "Galatasaray Hafıza Yarışı",
  description: "Galatasaray oyuncularını, sezonlarını ve tarihini eşleştir.",
};

export default function MemoryRacePage() {
  return <MemoryRaceGame />;
}
