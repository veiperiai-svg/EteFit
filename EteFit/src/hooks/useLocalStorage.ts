import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

export function hasConsented(): boolean {
  return localStorage.getItem("fitai-cookies-accepted") === "true";
}

export function setConsent(accepted: boolean) {
  localStorage.setItem("fitai-cookies-accepted", accepted ? "true" : "false");
}

export function hasCompletedOnboarding(): boolean {
  if (hasConsented()) {
    return localStorage.getItem("fitai-onboarding-done") === "true";
  }

  return sessionStorage.getItem("fitai-onboarding-done") === "true";
}

export function setOnboardingDone() {
  if (hasConsented()) {
    localStorage.setItem("fitai-onboarding-done", "true");
  } else {
    sessionStorage.setItem("fitai-onboarding-done", "true");
  }
}
