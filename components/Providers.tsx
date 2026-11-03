"use client";

import { MotionConfig } from "framer-motion";
import { VoiceProvider } from "./Voice";
import { PwaRegister } from "./PwaRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <VoiceProvider>
        {children}
        <PwaRegister />
      </VoiceProvider>
    </MotionConfig>
  );
}
