import type { Metadata } from "next";
import { ArithmeticDuel } from "@/components/arithmetic-duel/ArithmeticDuel";

export const metadata: Metadata = { title: "Mental Aritmetik Düellosu", description: "Arkadaşlarınla aynı işlemi en hızlı çöz." };

export default function Page() { return <ArithmeticDuel />; }
