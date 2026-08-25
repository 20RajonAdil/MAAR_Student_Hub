"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * Redirects to onboarding if there's no completed profile — but only once
 * we actually know that, i.e. after the persisted store has rehydrated from
 * localStorage. `persist` middleware rehydrates asynchronously after mount,
 * so checking `profile` before `hasHydrated` is true would misread "not
 * loaded yet" as "no account" and bounce a returning student to onboarding
 * on every refresh. Waiting for `hasHydrated` fixes that.
 */
export function useRequireProfile() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return; // still loading the student's saved data — wait
    if (profile?.onboardingComplete) {
      setReady(true);
    } else {
      router.replace("/onboarding");
    }
  }, [hasHydrated, profile, router]);

  return { ready, profile };
}
