"use client";

import { useRef, useState } from "react";
import { isPincode, lookupPincode, placeName, stateFits, type PincodeInfo } from "@/lib/pincode";

interface Outcome { status: "idle" | "checking" | "done"; info: PincodeInfo | null; chosenState: string }

// The PIN code box of an address form. Checks the PIN code as soon as it is complete, fills in the city when it is empty,
// warns when the state chosen does not fit, and stops the form while the PIN code does not exist.
export function PincodeField({ defaultValue = "", className, onPincode }: { defaultValue?: string; className: string; onPincode?: (pin: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle", info: null, chosenState: "" });

  const field = (name: string) => input.current?.form?.elements.namedItem(name) as HTMLInputElement | null;

  async function check(pin: string) {
    const el = input.current;
    if (!el || !isPincode(pin)) return;
    setOutcome({ status: "checking", info: null, chosenState: "" });
    const info = await lookupPincode(pin);
    // Typing on: this answer is for an older entry.
    if (el.value !== pin) return;
    el.setCustomValidity(info && !info.valid ? "We couldn't find this PIN code" : "");
    const city = field("city");
    if (info?.valid && info.city && city && !city.value.trim()) city.value = info.city;
    setOutcome({ status: "done", info, chosenState: field("state")?.value ?? "" });
  }

  function onChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (input.current) input.current.value = digits;
    input.current?.setCustomValidity(digits.length === 6 || digits === "" ? "" : "Enter a valid 6-digit PIN code");
    // The delivery charge can depend on the area, so the page prices the basket again once the PIN code is complete.
    onPincode?.(digits.length === 6 ? digits : "");
    if (digits.length === 6) void check(digits);
    else setOutcome({ status: "idle", info: null, chosenState: "" });
  }

  const { status, info, chosenState } = outcome;
  const mismatch = status === "done" && info?.valid && chosenState && !stateFits(chosenState, info);

  return (
    <div>
      <input ref={input} name="pincode" required pattern="[1-9][0-9]{5}" maxLength={6} inputMode="numeric" defaultValue={defaultValue} placeholder="Pincode" autoComplete="postal-code"
        aria-describedby="pincode-note" onChange={(e) => onChange(e.target.value)} onBlur={(e) => { if (isPincode(e.target.value)) void check(e.target.value); }} className={className} />
      <p id="pincode-note" aria-live="polite" className="mt-1 min-h-4 text-xs">
        {status === "checking" && <span className="text-muted">Checking PIN code…</span>}
        {status === "done" && info?.valid && !mismatch && <span className="text-brand-700">{placeName(info) ? `✓ ${placeName(info)}` : "✓ PIN code looks right"}</span>}
        {status === "done" && info && !info.valid && <span role="alert" className="text-red-600">We couldn&apos;t find this PIN code. Please check it.</span>}
        {mismatch && <span className="text-amber-800">This PIN code is in {info!.states.join(" or ")}, not {chosenState}. Please check the state.</span>}
      </p>
    </div>
  );
}
