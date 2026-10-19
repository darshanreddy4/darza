import { IN_STATES } from "./states";

type State = (typeof IN_STATES)[number];

// An Indian PIN code: six digits, the first one not zero.
export const PINCODE_FORMAT = /^[1-9]\d{5}$/;

const UP: State[] = ["Uttar Pradesh"];
const UK: State[] = ["Uttarakhand"];
const NORTH_EAST: State[] = ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura"];

// What each two-digit PIN prefix can belong to, by India Post's zones. Several states share a prefix at the edges.
// Prefixes missing from this list are not in use. Prefix 9 is the army post office.
const BY_PREFIX: Record<string, State[]> = {
  "11": ["Delhi"], "12": ["Haryana"], "13": ["Haryana"], "14": ["Punjab"], "15": ["Punjab"], "16": ["Punjab", "Chandigarh"],
  "17": ["Himachal Pradesh"], "18": ["Jammu and Kashmir"], "19": ["Jammu and Kashmir", "Ladakh"],
  "20": UP, "21": UP, "22": UP, "23": UP, "24": [...UP, ...UK], "25": UP, "26": [...UP, ...UK], "27": UP, "28": UP,
  "30": ["Rajasthan"], "31": ["Rajasthan"], "32": ["Rajasthan"], "33": ["Rajasthan"], "34": ["Rajasthan"],
  "36": ["Gujarat"], "37": ["Gujarat"], "38": ["Gujarat"], "39": ["Gujarat", "Dadra and Nagar Haveli and Daman and Diu"],
  "40": ["Maharashtra", "Goa"], "41": ["Maharashtra"], "42": ["Maharashtra"], "43": ["Maharashtra"], "44": ["Maharashtra"],
  "45": ["Madhya Pradesh"], "46": ["Madhya Pradesh"], "47": ["Madhya Pradesh"], "48": ["Madhya Pradesh"], "49": ["Chhattisgarh"],
  "50": ["Telangana", "Andhra Pradesh"], "51": ["Andhra Pradesh", "Telangana"], "52": ["Andhra Pradesh"], "53": ["Andhra Pradesh", "Puducherry"],
  "56": ["Karnataka"], "57": ["Karnataka"], "58": ["Karnataka"], "59": ["Karnataka"],
  "60": ["Tamil Nadu", "Puducherry"], "61": ["Tamil Nadu"], "62": ["Tamil Nadu"], "63": ["Tamil Nadu"], "64": ["Tamil Nadu"],
  "67": ["Kerala", "Puducherry"], "68": ["Kerala", "Lakshadweep"], "69": ["Kerala"],
  "70": ["West Bengal"], "71": ["West Bengal"], "72": ["West Bengal"], "73": ["West Bengal", "Sikkim"], "74": ["West Bengal", "Andaman and Nicobar Islands"],
  "75": ["Odisha"], "76": ["Odisha"], "77": ["Odisha"], "78": ["Assam"], "79": NORTH_EAST,
  "80": ["Bihar"], "81": ["Bihar", "Jharkhand"], "82": ["Jharkhand", "Bihar"], "83": ["Jharkhand"], "84": ["Bihar"], "85": ["Bihar", "Jharkhand"],
};

export interface PrefixInfo { known: boolean; states: State[]; army: boolean }

// What the first digits of a PIN code say about it; works offline.
export function prefixInfo(pin: string): PrefixInfo {
  if (!PINCODE_FORMAT.test(pin)) return { known: false, states: [], army: false };
  if (pin.startsWith("9")) return { known: true, states: [], army: true };
  const states = BY_PREFIX[pin.slice(0, 2)];
  return states ? { known: true, states, army: false } : { known: false, states: [], army: false };
}

const plain = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z]+/g, " ").trim();
const ALIASES: Record<string, State> = {
  orissa: "Odisha", pondicherry: "Puducherry", "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu", "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
};

// India Post's spelling of a state, as the name the shop uses; the original text when it is not one of them.
export function knownState(name: string): string {
  const key = plain(name);
  return IN_STATES.find((s) => plain(s) === key) ?? ALIASES[key] ?? name.trim();
}

export interface PincodeResult {
  pincode: string;
  valid: boolean;
  // Why a PIN code is not valid.
  reason?: "format" | "unknown";
  city?: string;
  district?: string;
  // The state when it is known for certain; `states` lists every state the PIN code could belong to.
  state?: string;
  states: string[];
  areas?: string[];
  // "post-office" when India Post's own record was found, "region" when only the PIN code's first digits were checked.
  source?: "post-office" | "region";
}

// Reads the answer of the India Post lookup: a found record, a definite "no such PIN code", or null when the answer is not understood.
export function parsePostOfficeAnswer(json: unknown): { found: true; city: string; district: string; state: string; areas: string[] } | { found: false } | null {
  const first = Array.isArray(json) ? (json[0] as { Status?: unknown; PostOffice?: unknown } | undefined) : undefined;
  if (!first || typeof first !== "object") return null;
  const offices = Array.isArray(first.PostOffice) ? (first.PostOffice as Record<string, unknown>[]) : [];
  if (String(first.Status).toLowerCase() === "success" && offices.length > 0) {
    const o = offices[0];
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const district = text(o.District);
    return {
      found: true, district, city: district || text(o.Block) || text(o.Name), state: knownState(text(o.State)),
      areas: offices.map((x) => text(x.Name)).filter(Boolean).slice(0, 6),
    };
  }
  // A real PIN code that has no post office on record comes back as "Error"/"404" with no offices.
  return String(first.Status).toLowerCase() === "success" ? null : { found: false };
}

// Does the state in an address fit the PIN code? True when nothing is known, so it never blocks anyone.
export const stateFitsPincode = (state: string, r: Pick<PincodeResult, "states">) => r.states.length === 0 || r.states.includes(state);
