export const WEB = process.env.E2E_WEB_URL ?? "http://localhost:3100";
export const API = process.env.E2E_API_URL ?? "http://localhost:4100";
// The same API and database with online payments switched on, against a stand-in for Razorpay.
export const API_ONLINE = process.env.E2E_API_ONLINE_URL ?? "http://localhost:4101";
export const RAZORPAY_STUB = "http://127.0.0.1:4198";
export const RAZORPAY_SECRET = "e2e-razorpay-secret";

export const PASSWORD = "E2e-Pass-12345";
export const ADMIN = { email: "e2e-admin@dmg.test", password: PASSWORD, name: "E2E Admin" };
export const CUSTOMER = { email: "e2e-customer@dmg.test", password: PASSWORD, name: "E2E Customer" };

export const AUTH_FILES = { admin: ".auth/admin.json", customer: ".auth/customer.json" };

export const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
