import type { Metadata } from "next";
import { MemoryRaceOnline } from "@/components/memory-race/MemoryRaceOnline";

export const metadata: Metadata = { title: "Hafıza Yarışı Online | Galatasaray Quiz", description: "Aynı hafıza parkurunda arkadaşlarınla canlı yarış." };
export default function Page() { return <MemoryRaceOnline />; }
