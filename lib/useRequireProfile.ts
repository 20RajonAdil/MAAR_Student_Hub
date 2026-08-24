"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/** Redirects to onboarding if there's no completed profile yet. Returns
 * `ready` so pages can avoid a flash of empty state before the redirect. */
export function useRequireProfile() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (profile?.onboardingComplete) {
      setReady(true);
    } else {
      router.replace("/onboarding");
    }
  }, [profile, router]);

  return { ready, profile };
}
