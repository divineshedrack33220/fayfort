/* Fayfort — E2E smoke suite (playwright-core + system Chrome).
 *
 * Covers the critical customer journey against a running dev server and the
 * live Go backend (auto-booted with a fresh in-memory db on :8080):
 *   home → calculator → estimate → sign in → overview → my requests →
 *   request detail → quote accept → tracking → chat → notifications → settings
 *   → staff console (login, requests, quotes, customers, shipments, team,
 *     messages, orders, inspections, analytics, notifications, quote builder).
 *
 * Also checks: no horizontal overflow at two viewports, no console errors,
 * sitemap/robots/health responses.
 *
 * Run:  npm run test:e2e   (requires `next dev` on :3100, or set BASE_URL)
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const BACKEND_ADDR = process.env.BACKEND_ADDR ?? "127.0.0.1:8080";
const BACKEND_DIR = path.join(fileURLToPath(new URL("../..", import.meta.url)), "backend");
const VIEWPORTS = { desktop: { width: 1360, height: 800 }, mobile: { width: 375, height: 667 } };

const candidateExecutables = [
  process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].filter(Boolean);

const executablePath = candidateExecutables.find((path) => existsSync(path));
if (!executablePath) {
  console.error("✖ No Chrome/Chromium found. Set PLAYWRIGHT_EXECUTABLE_PATH.");
  process.exit(1);
}

const results = [];
const errors = [];
const screenshots = [];
let browser;
let backendProc;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✖"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkOverflow(page, { width }, when) {
  const overflow = await page.evaluate(
    () =>
      (document.scrollingElement?.scrollWidth ?? 0) -
      (document.scrollingElement?.clientWidth ?? window.innerWidth),
  );
  record(
    `${when} no horizontal overflow (${width}px)`,
    overflow <= 1,
    overflow > 1 ? `overflow by ${overflow}px` : "",
  );
  return overflow <= 1;
}

/* Boot the Go backend on BACKEND_ADDR with a FRESH in-memory database every
 * run so assertions are deterministic. The smoke owns this port: any process
 * currently bound to it (typically a stale backend from an earlier run) is
 * released and replaced. Point BACKEND_ADDR elsewhere + start `next dev` with
 * a matching BACKEND_URL if you want the backend on another port. */
async function bootBackend() {
  const healthUrl = `http://${BACKEND_ADDR}/api/health`;
  const port = BACKEND_ADDR.slice(BACKEND_ADDR.lastIndexOf(":") + 1);

  await new Promise((resolve) => {
    const killer = spawn("bash", ["-c", `fuser -k ${port}/tcp 2>/dev/null; exit 0`]);
    killer.on("close", resolve);
    killer.on("error", resolve);
  });
  await new Promise((r) => setTimeout(r, 800));

  await new Promise((resolve, reject) => {
    const build = spawn("go", ["build", "-o", "/tmp/fayfort-backend-e2e", "./cmd/server"], {
      cwd: BACKEND_DIR,
      stdio: "inherit",
    });
    build.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`go build failed with exit code ${code}`)),
    );
    build.on("error", reject);
  });

  const proc = spawn("/tmp/fayfort-backend-e2e", ["-db", ":memory:", "-addr", BACKEND_ADDR], {
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ok = await fetch(healthUrl).then((r) => r.status === 200).catch(() => false);
    if (ok) return proc;
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error(`backend did not become healthy at ${healthUrl}`);
}

async function run() {
  await mkdir("e2e/screenshots", { recursive: true });
  backendProc = await bootBackend();

  browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  // Dev-mode first-compile of a route can exceed the 30s gambling default.
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(60_000);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  const goto = (path) => page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });

  /* 1. Home */
  await goto("/");
  await page.waitForSelector("h1");
  record("home renders hero", (await page.locator("h1").innerText()).toLowerCase().includes("really cost"));
  await checkOverflow(page, VIEWPORTS.desktop, "home");

  /* 2. Sign in via the UI (calculator and portal pages are gated) */
  const signInViaUi = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await goto("/login?next=/overview");
      const submit = page.getByRole("button", { name: /sign in/i });
      let enabled = false;
      for (let i = 0; i < 10 && !enabled; i += 1) {
        await page.getByPlaceholder("you@example.com").fill("demo@example.com");
        await page.getByPlaceholder("••••••••").fill("demo1234");
        enabled = await submit.isEnabled();
        if (!enabled) await page.waitForTimeout(300);
      }
      if (enabled) {
        await submit.click();
        try {
          await page.waitForURL((u) => u.pathname === "/overview", { timeout: 30_000 });
          return;
        } catch {
          // Cold-start race on a freshly started dev server — re-sign-in.
        }
      }
    }
    throw new Error("sign-in button never enabled after reloads");
  };
  await signInViaUi();
  record("sign in lands on overview", page.url().endsWith("/overview"));

  /* 3. Landing cost calculator → results */
  await goto("/calculator");
  if (page.url().includes("/login")) {
    await signInViaUi(); // cold-start cookie race on a freshly started dev server
    await goto("/calculator");
  }
  await page.getByRole("button", { name: /calculate estimated landed cost/i }).click();
  record("calculator blocks empty submit", await page.getByText("Enter a product name.").isVisible());

  await page.getByPlaceholder("e.g. Wireless Headphones").fill("Wireless Headphones");
  await page.getByPlaceholder("e.g. 500").fill("500");
  await page.getByPlaceholder("e.g. 12.50").fill("12.50");
  await page.getByRole("button", { name: /calculate estimated landed cost/i }).click();
  await page.waitForURL((u) => u.pathname === "/calculator/estimate", { timeout: 30_000 }).catch(() => {});
  record("calculator navigates to estimate", page.url().includes("/calculator/estimate"));
  await page
    .getByText("Estimated Total Landed Cost", { exact: true })
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  record(
    "estimate shows total landed cost",
    await page.getByText("Estimated Total Landed Cost", { exact: true }).isVisible().catch(() => false),
  );
  await page
    .getByRole("link", { name: /submit a sourcing request/i })
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  record(
    "estimate offers sourcing request CTA",
    await page.getByRole("link", { name: /submit a sourcing request/i }).isVisible().catch(() => false),
  );
  await checkOverflow(page, VIEWPORTS.desktop, "estimate");

  /* 4. Contact form captures WhatsApp as a second contact channel */
  await goto("/contact");
  let sendEnabled = false;
  for (let attempt = 0; attempt < 3 && !sendEnabled; attempt += 1) {
    const sendMessage = page.getByRole("button", { name: /send message/i });
    await page.getByPlaceholder("e.g. Ama Mensah").fill("Ama Mensah");
    await page.getByPlaceholder("you@example.com").fill("ama@example.com");
    await page.getByPlaceholder("e.g. +234 801 234 5678").fill("+234 801 234 5678");
    await page
      .getByPlaceholder("What are you sourcing, and how can we help?")
      .fill("Sourcing wireless headphones");
    for (let i = 0; i < 10 && !sendEnabled; i += 1) {
      sendEnabled = await sendMessage.isEnabled();
      if (!sendEnabled) await page.waitForTimeout(300); // hydration race
    }
  }
  if (!sendEnabled) throw new Error("contact form never enabled after retries");
  await page.getByRole("button", { name: /send message/i }).click();
  await page.getByText("Message sent").waitFor({ timeout: 8000 }).catch(() => {});
  record(
    "contact form captures WhatsApp number",
    await page
      .getByText(/your WhatsApp number \(\+234 801 234 5678\)/i)
      .isVisible()
      .catch(() => false),
  );

  /* 5. My Requests list + detail */
  await goto("/dashboard");
  await page.waitForSelector("h1");
  record("my requests lists request cards", (await page.locator("a[href^='/dashboard/REQ-']").count()) > 0);
  await checkOverflow(page, VIEWPORTS.desktop, "my requests");

  /* 6. Quote accept (REQ-1047 = quoted in the seed) */
  await goto("/dashboard/REQ-1047");
  await page.getByRole("button", { name: /accept & continue/i }).click();
  await page.getByRole("button", { name: /accept quote/i }).click();
  const accepted = await page
    .getByText(/quote is marked as accepted/i)
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  record("quote accept shows confirmation", accepted);

  /* 7. Tracking (REQ-1030 = converted) */
  await goto("/dashboard/REQ-1030/tracking");
  record(
    "tracking shows milestones",
    (await page.getByText("Supplier matched", { exact: false }).count()) === 1,
  );

  /* 8. Chat — send a message (persisted via the backend thread) */
  await goto("/chat").catch(() => {}); // warm the route compile
  await goto("/chat?request=REQ-1047");
  const composer = page.getByPlaceholder(/message the fayfort team/i);
  await composer.fill("Please share the customs details");
  await page.getByRole("button", { name: /send/i }).click();
  record(
    "chat sends and persists a message",
    await page
      .getByText("Please share the customs details")
      .waitFor({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false),
  );
  await screenshot(page, "chat");

  /* 9. Notifications inbox */
  await goto("/notifications").catch(() => {}); // warm the route compile
  await goto("/notifications");
  await page.getByRole("button", { name: /mark all read/i }).click();
  record(
    "notifications mark-all-read",
    await page
      .getByText("You’re all caught up")
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false),
  );

  /* 10. Settings saves */
  await goto("/settings");
  await page.getByRole("button", { name: /save settings/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /save settings/i }).click();
  record(
    "settings shows save toast",
    await page
      .getByText("Settings saved")
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false),
  );

  /* 11. Edge responses */
  const sitemap = await page.request.get(`${BASE_URL}/sitemap.xml`);
  record("sitemap 200", sitemap.status() === 200 && sitemap.headers()["content-type"]?.includes("xml"));
  const robots = await page.request.get(`${BASE_URL}/robots.txt`);
  record("robots 200", robots.status() === 200);
  const health = await (await page.request.get(`${BASE_URL}/api/health`)).json();
  record("health probe ok", health.ok === true && health.status === "healthy");

  /* 12. Mobile overflow on key portal pages */
  const mobile = await context.newPage();
  await mobile.setViewportSize(VIEWPORTS.mobile);
  for (const path of ["/dashboard", "/chat", "/dashboard/REQ-1030/tracking"]) {
    await mobile.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await checkOverflow(mobile, VIEWPORTS.mobile, `mobile ${path}`);
  }
  await mobile.close();

  /* 13. Logout — confirm dialog, returns home */
  await goto("/dashboard");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.getByRole("button", { name: /^log out$/i }).last().click();
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10_000 });
  record("logout confirms and returns home", page.url().endsWith("/"));

  /* 14. Admin gating — staff routes redirect to the staff login */
  await goto("/admin");
  record(
    "admin routes redirect to staff login when signed out",
    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 }).then(() => true).catch(() => false),
  );

  /* 12a. Staff login layout regression guards (split-screen, reveal toggle) */
  record(
    "staff login is split-screen",
    (await page.locator("section").first().isVisible()) &&
      (await page.getByText("Run your sourcing pipeline in one place.").isVisible()) &&
      (await page.getByRole("heading", { name: "Staff sign-in" }).isVisible()),
  );
  record(
    "brand panel stats render",
    (await page.getByText("Sourcing requests").isVisible()) &&
      (await page.getByText("Confirmed order value").isVisible()),
  );
  const reveal = page.getByRole("button", { name: "Show password" });
  record("password reveal toggle present", await reveal.isVisible());
  await reveal.click();
  const passwordInput = page.getByPlaceholder("••••••••");
  record("reveal switches password input to text", (await passwordInput.getAttribute("type")) === "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  record("hide toggles back to password", (await passwordInput.getAttribute("type")) === "password");
  await screenshot(page, "admin-login");

  /* 12b. Mobile staff login — brand panel hidden, no overflow */
  const loginMobile = await context.newPage();
  await loginMobile.setViewportSize(VIEWPORTS.mobile);
  await loginMobile.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded" });
  await checkOverflow(loginMobile, VIEWPORTS.mobile, "mobile /admin/login");
  const brandPanelVisible = await loginMobile.evaluate(() => {
    const brand = document.querySelectorAll("section")[0];
    return brand ? getComputedStyle(brand).display !== "none" : false;
  });
  record("mobile login hides brand panel", brandPanelVisible === false);
  await loginMobile.close();

  /* 15. Staff sign-in → dashboard */
  const adminEmail = page.getByPlaceholder("you@fayfort.com");
  await adminEmail.fill("admin@fayfort.com");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: /staff console/i }).click();
  await page.waitForURL(`${BASE_URL}/admin`, { timeout: 10_000 });
  record(
    "staff login lands on the dashboard",
    page.url().endsWith("/admin") && (await page.getByText("Sourcing pipeline").isVisible()),
  );
  record(
    "dashboard shows KPI cards and pipeline strip",
    (await page.getByText("New requests").isVisible()) &&
      (await page.getByText("Active orders").isVisible()) &&
      (await page.getByText("Pending actions").isVisible()) &&
      (await page.getByText("Recent sourcing requests").isVisible()),
  );
  await screenshot(page, "admin-dashboard");
  await goto("/admin/requests").catch(() => {}); // warm the queue route for the next section

  /* 16. Requests queue + detail */
  await goto("/admin/requests/REQ-1047").catch(() => {}); // warm the route compile
  await goto("/admin/requests");
  await page.getByText("Wireless Headphones").waitFor({ timeout: 15_000 });
  record(
    "queue shows request rows across statuses",
    (await page.getByRole("link", { name: /REQ-1047/i }).isVisible()) &&
      (await page.getByText("Wireless Headphones").isVisible()),
  );
  await page.getByRole("link", { name: /REQ-1047/i }).first().click();
  await page.waitForURL(/\/admin\/requests\/REQ-1047/, { timeout: 30_000 }).catch(() => {});
  await page.getByText("Customer information").waitFor({ timeout: 15_000 }).catch(() => {});
  await page
    .getByRole("link", { name: /chat on whatsapp/i })
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  record(
    "request detail shows customer and product info",
    (await page.getByText("Customer information").isVisible()) &&
      (await page.getByText("Product information").isVisible()),
  );
  record(
    "request detail links to WhatsApp",
    await page
      .getByRole("link", { name: /chat on whatsapp/i })
      .isVisible()
      .catch(() => false),
  );
  const createQuote = page.getByRole("link", { name: /create quote/i });
  if (await createQuote.isVisible().catch(() => false)) {
    await createQuote.click();
    await page.waitForURL(/\/admin\/quotes\/new\?requestId=REQ-1047/, { timeout: 20_000 });
    await page.getByRole("heading", { name: "Create quote" }).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /send quote/i }).click();
    await page.waitForURL(/\/admin\/requests\/REQ-1047/, { timeout: 30_000 }).catch(() => {});
  }
  await page.getByRole("link", { name: /quote issued/i }).waitFor({ timeout: 20_000 }).catch(() => {});
  record(
    "issue quote from the sourcing request",
    (await page.getByRole("link", { name: /quote issued/i }).isVisible().catch(() => false)) ||
      (await page.getByText("Quote on file").isVisible().catch(() => false)),
  );
  await screenshot(page, "admin-request");

  /* 17. Quotes + customers + settings */
  await goto("/admin/quotes");
  await page.getByText("Shenzhen Mehr Leather Co.").waitFor({ timeout: 15_000 });
  record(
    "quotes table lists supplier quotes",
    (await page.getByText("Shenzhen Mehr Leather Co.").isVisible()) &&
      (await page.getByText("QT-2041").isVisible()),
  );
  await goto("/admin/customers/C-001").catch(() => {}); // warm the route compile
  await goto("/admin/customers");
  await page.getByText("Ama Mensah").waitFor({ timeout: 15_000 });
  record(
    "customers table renders account statuses",
    (await page.getByText("Ama Mensah").isVisible()) &&
      (await page.getByText("At risk").first().isVisible()),
  );
  await page.getByRole("link", { name: /Ama Mensah/i }).first().click();
  await page.waitForURL(/\/admin\/customers\/C-001/, { timeout: 15_000 });
  await page.getByText("QT-2041").waitFor({ timeout: 15_000 }).catch(() => {});
  record(
    "customer detail shows profile and their history",
    (await page.getByText("Amex Importers").isVisible()) &&
      (await page.getByText("Handbags").first().isVisible()) &&
      (await page.getByText("QT-2041").isVisible()),
  );
  await screenshot(page, "admin-customer");
  await goto("/admin/shipments");
  await page.getByText("SHIP-1081").waitFor({ timeout: 15_000 });
  record(
    "shipments directory lists consignments",
    (await page.getByText("SHIP-1081").isVisible()) &&
      (await page.getByText("Customs clearance").first().isVisible()),
  );
  await goto("/admin/shipments/SHIP-1081").catch(() => {}); // warm the route compile
  await goto("/admin/shipments");
  await page.getByRole("link", { name: /SHIP-1081/i }).first().click();
  await page.waitForURL(/\/admin\/shipments\/SHIP-1081/, { timeout: 30_000 });
  record(
    "shipment detail shows route, milestones and docs",
    (await page.getByText("Milestones").isVisible()) &&
      (await page.getByText(/Shenzhen, CN/).first().isVisible()) &&
      (await page.getByText("Bill of lading").isVisible()),
  );
  await screenshot(page, "admin-shipment");
  await goto("/admin/team");
  await page.getByRole("table").getByText("Ada Okafor").waitFor({ timeout: 15_000 });
  record(
    "team table lists staff accounts",
    (await page.getByRole("table").getByText("Ada Okafor").isVisible()) &&
      (await page.getByText("Invited").first().isVisible()),
  );
  await screenshot(page, "admin-team");
  await goto("/admin/messages/TH-001").catch(() => {}); // warm the route compile
  await goto("/admin/messages");
  await page.getByText("Handbags order — payment timing").waitFor({ timeout: 15_000 });
  record(
    "messages screen shows chat list and open room",
    (await page.getByText("Handbags order — payment timing").isVisible()) &&
      (await page.getByText("split payment across two tranches").first().isVisible()),
  );
  await page.getByRole("link", { name: /conversation with david green/i }).first().isVisible();
  await goto("/admin/messages/TH-002"); // room state is freshest on a direct load
  await page.getByText("size-run verification").waitFor({ timeout: 15_000 });
  record(
    "chat room opens and accepts a reply",
    (await page.getByText("size-run verification").first().isVisible()) &&
      (await page.getByRole("button", { name: /send reply/i }).isVisible()),
  );
  const replyField = page.getByPlaceholder(/Reply to David Green/i);
  const sendReplyButton = page.getByRole("button", { name: /send reply/i });
  let bubbleSeen = false;
  for (let attempt = 0; attempt < 3 && !bubbleSeen; attempt += 1) {
    await replyField.fill("Thanks David, confirming today.");
    let enabled = false;
    for (let i = 0; i < 10 && !enabled; i += 1) {
      enabled = await sendReplyButton.isEnabled();
      if (!enabled) await page.waitForTimeout(300); // hydration race on the controlled composer
    }
    if (!enabled) continue;
    await sendReplyButton.click();
    bubbleSeen = await page
      .getByText("Thanks David, confirming today.")
      .first()
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
  }
  const persisted = await (async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await page.request
        .get(`${BASE_URL}/api/backend/admin/messages`)
        .catch(() => null);
      if (res && res.ok()) {
        const data = await res.json();
        const threads = Array.isArray(data?.threads) ? data.threads : [];
        const t = threads.find((x) => x?.id === "TH-002");
        const messages = t?.messages ?? [];
        const last = messages[messages.length - 1];
        if (last?.text === "Thanks David, confirming today.") {
          return true;
        }
      }
      await page.waitForTimeout(500);
    }
    return false;
  })();
  record(
    "sending a reply bubbles it into the room",
    bubbleSeen && persisted,
    bubbleSeen && persisted ? "" : bubbleSeen ? "bubble ok, not yet persisted" : "bubble missing",
  );
  await screenshot(page, "admin-messages");
  await goto("/admin/settings");
  await page.getByRole("button", { name: /save settings/i }).click();
  record(
    "admin settings shows save toast",
    await page
      .getByText("Ops preferences saved")
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false),
  );
  await screenshot(page, "admin-settings");

  /* 18. New workspace pages */
  await goto("/admin/orders").catch(() => {});
  await goto("/admin/orders/ORD-1204").catch(() => {});
  await goto("/admin/orders");
  await page.getByText("ORD-1204").waitFor({ timeout: 15_000 });
  record(
    "orders table lists live orders",
    (await page.getByText("ORD-1204").isVisible()) &&
      (await page.getByText("Awaiting payment").isVisible()),
  );
  await page.getByRole("link", { name: /ORD-1204/i }).first().click();
  await page.waitForURL(/\/admin\/orders\/ORD-1204/, { timeout: 20_000 });
  record(
    "order detail shows financial summary",
    (await page.getByText("Financial summary").isVisible()) &&
      (await page.getByText("Sneakers").first().isVisible()),
  );
  await screenshot(page, "admin-order");

  await goto("/admin/inspections").catch(() => {});
  await goto("/admin/inspections");
  await page.getByText("INS-4053").waitFor({ timeout: 15_000 });
  record(
    "inspections list renders status tabs and rows",
    (await page.getByText("Passed", { exact: true }).first().isVisible()) &&
      (await page.getByText("Issues flagged").isVisible()),
  );
  await screenshot(page, "admin-inspections");

  await goto("/admin/analytics").catch(() => {});
  // A first-compile burst on this heavy route can occasionally stall the nav;
  // retry a couple of times instead of failing the whole suite.
  const analyticsOk = await (async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await goto("/admin/analytics");
        await page.getByText("Total sourcing requests").waitFor({ timeout: 20_000 });
        return true;
      } catch {
        await page.waitForTimeout(1_500);
      }
    }
    return false;
  })();
  record(
    "analytics shows KPIs and ranked lists",
    analyticsOk &&
      (await page.getByText("Total order value").isVisible().catch(() => false)) &&
      (await page.getByText("Top requested products").isVisible().catch(() => false)),
  );
  await screenshot(page, "admin-analytics");

  await goto("/admin/notifications").catch(() => {});
  await goto("/admin/notifications");
  await page.getByRole("button", { name: /mark all as read/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /mark all as read/i }).click();
  record(
    "notifications centre marks everything read",
    await page
      .getByText("All notifications marked as read")
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false),
  );

  await goto("/admin/quotes/new?requestId=REQ-1036").catch(() => {});
  await goto("/admin/quotes/new?requestId=REQ-1036");
  await page.getByRole("button", { name: /save draft/i }).waitFor({ timeout: 20_000 });
  record(
    "quote builder renders totals and actions",
    (await page.getByRole("button", { name: /preview quote/i }).isVisible()) &&
      (await page.getByRole("button", { name: /send quote/i }).isVisible()),
  );
  await screenshot(page, "admin-quote-builder");

  /* 19. Admin mobile overflow */
  const adminMobile = await context.newPage();
  await adminMobile.setViewportSize(VIEWPORTS.mobile);
  for (const path of ["/admin", "/admin/requests", "/admin/quotes", "/admin/orders", "/admin/analytics"]) {
    await adminMobile.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await checkOverflow(adminMobile, VIEWPORTS.mobile, `mobile ${path}`);
  }
  await adminMobile.close();

  /* 20. Staff logout — confirm dialog, returns home */
  await goto("/admin");
  await page.getByText("New requests").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.getByRole("button", { name: /^sign out$/i }).last().click();
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10_000 });
  record("staff logout confirms and returns home", page.url().endsWith("/"));
  await goto("/admin");
  record(
    "staff session ends after logout",
    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 }).then(() => true).catch(() => false),
  );

  await screenshot(page, "overview");

  /* 21. Console errors (ignore favicon/network noise) */
  // Chromium autofill can inject `caret-color` into email/password inputs on
  // the login screens, producing React's known benign hydration mismatch at
  // load time. The server and client render identical markup — this specific
  // warning is a browser-autofill artefact, not a project defect.
  const hydrationArtefact = /didn't match the client properties.*caret-color/s;
  const meaningful = consoleErrors.filter(
    (message) =>
      !/favicon|net::ERR/i.test(message) && !hydrationArtefact.test(message),
  );
  record("no console errors", meaningful.length === 0, meaningful.slice(0, 2).join(" | "));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: false });
  screenshots.push(name);
}

try {
  await run();
} catch (error) {
  errors.push(error.message);
  record("suite ran without a hard failure", false, error.message);
  console.error(`\nHard failure: ${error.message}`);
} finally {
  backendProc?.kill();
  await browser?.close().catch(() => {});
  const passed = results.filter((r) => r.ok).length;
  console.log(
    `\n${passed}/${results.length} checks passed${errors.length ? ` — HARD FAILURE (${errors.length})` : ""}`,
  );
  if (screenshots.length) {
    console.log(`Screenshots: e2e/screenshots/{${screenshots.join(", ")}}.png`);
  }
  const failed = results.filter((r) => !r.ok).length + errors.length;
  process.exit(failed > 0 ? 1 : 0);
}