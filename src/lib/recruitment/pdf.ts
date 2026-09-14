import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { formatBangladeshDate } from "@/lib/bangladesh-time";

export type EmploymentPdfProfile = {
  user: { name: string; username: string; role: string };
  fatherName: string;
  address: string;
  phone: string;
  nidNumber: string;
  designation: string;
  baseSalary: number;
  probationCompensation: number;
  probationStartDate: Date;
  probationEndDate: Date;
  dutyStartTime: string;
  workOffDeadline: string;
  eveningBreakMinutes: number;
  permanentJoinDate: Date | null;
  agreementStartDate: Date | null;
  agreementEndDate: Date | null;
  earlyExitSettlementLimit: number;
  terminationDate: Date | null;
  terminationReason: string | null;
};

type DocumentBlock = {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  witness?: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "").normalize("NFC");
}

function escapeHtml(value: unknown) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: number) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function identityHtml(profile: EmploymentPdfProfile) {
  const rows = [
    ["নাম", profile.user.name],
    ["পিতার নাম", profile.fatherName],
    ["পদবি", profile.designation],
    ["মোবাইল", profile.phone],
    ["জাতীয় পরিচয়পত্র", profile.nidNumber],
    ["ঠিকানা", profile.address],
  ];

  return `
    <div class="identity">
      ${rows
        .map(
          ([label, value]) => `
            <div class="identity-row">
              <div class="identity-label">${escapeHtml(label)}:</div>
              <div class="identity-value">${escapeHtml(value || "-")}</div>
            </div>`,
        )
        .join("")}
    </div>
  `;
}

function paragraph(text: string) {
  return `<p>${escapeHtml(text)}</p>`;
}

function clauses(items: string[]) {
  return `<div class="clauses">${items.map((item) => paragraph(item)).join("")}</div>`;
}

function signatures(includeWitness = false) {
  const labels = includeWitness
    ? ["কর্মীর স্বাক্ষর", "কোম্পানির পক্ষে", "সাক্ষী"]
    : ["কর্মীর স্বাক্ষর", "কোম্পানির পক্ষে"];

  return `
    <div class="signatures ${includeWitness ? "three" : "two"}">
      ${labels
        .map(
          (label) => `
            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-label">${escapeHtml(label)}</div>
            </div>`,
        )
        .join("")}
    </div>
  `;
}

function documentHtml(profile: EmploymentPdfProfile, block: DocumentBlock) {
  return `
    <section class="document-page">
      <header class="office-header">
        <div class="office-brand">
          <div class="brand-name">Trendy Deals BD</div>
          <div class="brand-meta">01712969880</div>
          <div class="brand-meta">Auth by Abdullah al sabbir</div>
        </div>
        <div class="document-heading">
          <div class="document-title">${escapeHtml(block.title)}</div>
          ${block.subtitle ? `<div class="document-subtitle">${escapeHtml(block.subtitle)}</div>` : ""}
        </div>
      </header>
      <div class="header-rule"></div>

      ${identityHtml(profile)}

      <div class="identity-rule"></div>
      <main class="document-body">
        ${block.bodyHtml}
      </main>

      ${signatures(Boolean(block.witness))}
    </section>
  `;
}

async function fontDataUri() {
  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "NotoSansBengali-Regular.ttf",
  );
  const font = await readFile(fontPath);
  return `data:font/ttf;base64,${font.toString("base64")}`;
}

async function buildHtml(profile: EmploymentPdfProfile, blocks: DocumentBlock[]) {
  const fontUri = await fontDataUri();
  return `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @font-face {
      font-family: "Noto Sans Bengali Local";
      src: url("${fontUri}") format("truetype");
      font-weight: 100 900;
      font-style: normal;
      font-display: block;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: "Noto Sans Bengali Local", "Noto Sans Bengali", sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 12.4px;
      line-height: 1.62;
    }

    .document-page {
      width: 210mm;
      min-height: 297mm;
      padding: 11mm 10mm 13mm 10mm;
      break-after: page;
      page-break-after: always;
      position: relative;
      background: white;
    }

    .document-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .office-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12mm;
    }

    .office-brand {
      flex: 1 1 45%;
    }

    .brand-name {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 26px;
      line-height: 1.1;
      font-weight: 500;
      letter-spacing: .1px;
    }

    .brand-meta {
      font-family: Arial, Helvetica, sans-serif;
      color: #64748b;
      font-size: 12px;
      line-height: 1.55;
      margin-top: 2px;
    }

    .document-heading {
      flex: 1 1 55%;
      text-align: right;
      padding-top: 1px;
    }

    .document-title {
      font-size: 20px;
      line-height: 1.35;
      font-weight: 700;
      color: #111827;
      white-space: normal;
    }

    .document-subtitle {
      margin-top: 3px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #64748b;
    }

    .header-rule,
    .identity-rule {
      height: 1px;
      background: #cbd5e1;
    }

    .header-rule {
      margin: 6mm 0 4mm;
    }

    .identity {
      margin: 0 5mm;
    }

    .identity-row {
      display: grid;
      grid-template-columns: 39mm minmax(0, 1fr);
      gap: 3mm;
      align-items: start;
      min-height: 6.2mm;
      break-inside: avoid;
    }

    .identity-label {
      color: #64748b;
      font-size: 12px;
    }

    .identity-value {
      color: #111827;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .identity-rule {
      margin: 4mm 5mm 4mm;
    }

    .document-body {
      margin: 0 5mm;
      font-size: 13px;
      line-height: 1.68;
      color: #111827;
      text-align: left;
    }

    .document-body p {
      margin: 0 0 4.2mm 0;
      orphans: 3;
      widows: 3;
    }

    .clauses p {
      margin-bottom: 3.5mm;
    }

    .signatures {
      display: grid;
      gap: 8mm;
      margin: 18mm 5mm 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .signatures.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .signatures.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }

    .signature-line {
      border-top: 1px solid #cbd5e1;
      height: 5mm;
    }

    .signature-label {
      color: #64748b;
      font-size: 11px;
    }

    @media print {
      .document-page {
        overflow: visible;
      }
    }
  </style>
</head>
<body>
  ${blocks.map((block) => documentHtml(profile, block)).join("\n")}
</body>
</html>`;
}

function resolveChromiumPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const CHROME_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-zygote",
  "--single-process",
  "--no-first-run",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-features=Translate,BackForwardCache,MediaRouter,OptimizationHints",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
] as const;

let sharedBrowser: any = null;
let sharedBrowserPromise: Promise<any> | null = null;
let pdfJobTail: Promise<void> = Promise.resolve();

function isSpawnEagain(error: unknown) {
  if (!(error instanceof Error)) return false;
  const withCode = error as Error & { code?: string };
  return withCode.code === "EAGAIN" || /\bEAGAIN\b/i.test(error.message);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchBrowser(puppeteer: any, executablePath: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await puppeteer.launch({
        executablePath,
        headless: true,
        timeout: 60000,
        args: [...CHROME_ARGS],
      });
    } catch (error) {
      lastError = error;
      if (!isSpawnEagain(error) || attempt === 3) throw error;
      await sleep(attempt * 750);
    }
  }

  throw lastError;
}

async function getBrowser(puppeteer: any, executablePath: string) {
  if (sharedBrowser?.connected) return sharedBrowser;

  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchBrowser(puppeteer, executablePath)
      .then((browser) => {
        sharedBrowser = browser;
        browser.on("disconnected", () => {
          if (sharedBrowser === browser) sharedBrowser = null;
        });
        return browser;
      })
      .finally(() => {
        sharedBrowserPromise = null;
      });
  }

  return sharedBrowserPromise;
}

async function runPdfJob<T>(job: () => Promise<T>): Promise<T> {
  const previous = pdfJobTail;
  let release!: () => void;
  pdfJobTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await job();
  } finally {
    release();
  }
}

async function renderPdf(html: string) {
  const executablePath = resolveChromiumPath();
  if (!executablePath) {
    throw new Error(
      "Recruitment PDF generation failed: Chromium/Chrome executable not found. Set PUPPETEER_EXECUTABLE_PATH.",
    );
  }

  const puppeteer = (await import("puppeteer-core")).default;

  return runPdfJob(async () => {
    const browser = await getBrowser(puppeteer, executablePath);
    let page: any = null;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "load", timeout: 60000 });
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      await page.emulateMediaType("print");

      return await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => undefined);
      }
    }
  });
}

export async function createProbationPacket(profile: EmploymentPdfProfile) {
  const blocks: DocumentBlock[] = [
    {
      title: "১৫ দিনের প্রাথমিক নিয়োগপত্র",
      subtitle: `${formatBangladeshDate(profile.probationStartDate)} - ${formatBangladeshDate(profile.probationEndDate)}`,
      bodyHtml: [
        `প্রিয় ${profile.user.name}, Trendy Deals BD-এ ${profile.designation} পদে আপনাকে ১৫ দিনের প্রাথমিক মূল্যায়ন/শিক্ষানবিশ পর্যায়ে নিয়োগ প্রদান করা হলো। এই সময়কাল ${formatBangladeshDate(profile.probationStartDate)} থেকে ${formatBangladeshDate(profile.probationEndDate)} পর্যন্ত কার্যকর থাকবে।`,
        `স্থায়ী নিয়োগের জন্য প্রস্তাবিত মূল বেতন ${money(profile.baseSalary)}। প্রাথমিক সময়ের নির্ধারিত ভাতা/পারিশ্রমিক ${money(profile.probationCompensation)}; তবে প্রযোজ্য আইন অনুযায়ী কোনো মজুরি, ভাতা বা অন্য পাওনা প্রদেয় হলে আইনই অগ্রাধিকার পাবে।`,
        `কর্মীকে তার নির্ধারিত দায়িত্বের পাশাপাশি অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজনে অর্পিত অন্যান্য কাজে সহযোগিতা করতে হবে। দৈনিক কাজের সময়, বিরতি, সাপ্তাহিক ছুটি ও অতিরিক্ত কাজ প্রযোজ্য আইন, প্রকাশিত রোস্টার এবং কোম্পানির নীতিমালা অনুযায়ী পরিচালিত হবে। OMS-এ দৈনিক Work Off সর্বোচ্চ ${profile.workOffDeadline} এর মধ্যে সম্পন্ন করতে হবে, যদি না অনুমোদিত রোস্টার বা দায়িত্ব ভিন্ন কিছু নির্ধারণ করে।`,
        `সান্ধ্য বিরতির নির্ধারিত সময় ${profile.eveningBreakMinutes} মিনিট। দেরিতে উপস্থিতি, অনুমোদন ছাড়া অনুপস্থিতি বা বিরতির সময় অতিক্রম করলে তা উপস্থিতি লঙ্ঘন হিসেবে নথিভুক্ত হতে পারে। কোনো আর্থিক কর্তন বা জরিমানা কেবল প্রযোজ্য আইন ও অনুমোদিত নীতিমালা অনুসারে করা যাবে।`,
        `এই ১৫ দিনের শেষে উভয় পক্ষ কাজের উপযোগিতা, আচরণ, গোপনীয়তা রক্ষা, উপস্থিতি ও পারফরম্যান্স বিবেচনা করবে। সন্তোষজনক হলে স্থায়ী নিয়োগের জন্য পৃথক যোগদানপত্র, নিয়োগপত্র ও চুক্তি প্রদান করা হবে; অন্যথায় প্রযোজ্য আইন ও নীতিমালা অনুযায়ী সম্পর্ক সমাপ্ত করা যেতে পারে।`,
      ]
        .map(paragraph)
        .join(""),
    },
    {
      title: "১৫ দিনের গোপনীয়তা ও দায়িত্ব চুক্তি",
      subtitle: "Trendy Deals BD",
      witness: true,
      bodyHtml: clauses([
        "১. কর্মী সততা, শৃঙ্খলা ও দায়িত্বশীলতার সঙ্গে অর্পিত কাজ সম্পন্ন করবেন এবং অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজন অনুযায়ী সহযোগিতা করবেন।",
        `২. উপস্থিতি, অফিস রোস্টার, অনুমোদিত বিরতি ও OMS Attendance-এর নিয়ম অনুসরণ করতে হবে। সান্ধ্য বিরতি ${profile.eveningBreakMinutes} মিনিটের বেশি হলে বা নির্ধারিত সময়ে উপস্থিত না হলে তা লঙ্ঘন হিসেবে নথিভুক্ত হতে পারে।`,
        "৩. গ্রাহকের নাম, ফোন নম্বর, ঠিকানা, অর্ডার, পেমেন্ট, কুরিয়ার, অভিযোগ বা অন্য কোনো গ্রাহক-তথ্য কেবল অনুমোদিত অফিসিয়াল কাজে ব্যবহার করা যাবে।",
        "৪. পণ্যের সোর্স, ক্রয়মূল্য, সরবরাহকারী, SKU, স্টক, বিজ্ঞাপন ডেটা, ব্যবসায়িক কৌশল, সফটওয়্যার লগইন, রিপোর্ট, ডাটাবেস বা অন্য কোনো সংবেদনশীল তথ্য কারও সঙ্গে শেয়ার, কপি, বিক্রি বা ব্যক্তিগত কাজে ব্যবহার করা যাবে না।",
        "৫. গোপনীয়তার বাধ্যবাধকতা চাকরির সময় এবং চাকরি/চুক্তি শেষ হওয়ার পরও প্রযোজ্য থাকবে, যতদিন তথ্যটি আইনসঙ্গতভাবে গোপনীয় থাকে।",
        "৬. অফিসের ডিভাইস, অ্যাকাউন্ট, পাসওয়ার্ড, নথি ও সম্পদ নিরাপদ রাখতে হবে এবং অনুমতি ছাড়া বহিরাগত ব্যক্তি বা ব্যক্তিগত প্ল্যাটফর্মে ব্যবহার করা যাবে না।",
        "৭. বেতন, দায়িত্ব বা পদে পরিবর্তন লিখিতভাবে জানানো হবে এবং প্রযোজ্য আইন ও পারস্পরিক চুক্তির সঙ্গে সামঞ্জস্য রেখে কার্যকর করা হবে।",
        "৮. কোনো শৃঙ্খলামূলক ব্যবস্থা, বেতন কর্তন, ক্ষতিপূরণ বা চাকরি সমাপ্তির ক্ষেত্রে প্রযোজ্য আইন, ন্যায়সংগত প্রক্রিয়া এবং কোম্পানির অনুমোদিত নীতিমালা অনুসরণ করা হবে।",
        "৯. ১৫ দিনের মূল্যায়ন শেষে স্থায়ী নিয়োগ স্বয়ংক্রিয় নয়; উভয় পক্ষের উপযোগিতা ও প্রযোজ্য আইন অনুযায়ী পরবর্তী সিদ্ধান্ত নেওয়া হবে।",
      ]),
    },
  ];

  return renderPdf(await buildHtml(profile, blocks));
}

export async function createPermanentPacket(profile: EmploymentPdfProfile) {
  const joinDate = profile.permanentJoinDate || profile.agreementStartDate || new Date();
  const contractStart = profile.agreementStartDate || joinDate;
  const contractEnd = profile.agreementEndDate || joinDate;

  const blocks: DocumentBlock[] = [
    {
      title: "যোগদানপত্র",
      subtitle: formatBangladeshDate(joinDate),
      bodyHtml: [
        `আমি, ${profile.user.name}, Trendy Deals BD-এ ${profile.designation} পদে ${formatBangladeshDate(joinDate)} তারিখে যোগদান করছি। প্রতিষ্ঠানের বৈধ নীতিমালা, দায়িত্ব, উপস্থিতি, তথ্য-নিরাপত্তা ও গোপনীয়তার শর্তসমূহ মেনে দায়িত্ব পালনের অঙ্গীকার করছি।`,
        `আমার নির্ধারিত মূল বেতন ${money(profile.baseSalary)}। বেতন, ভাতা, ছুটি, কর্মঘণ্টা ও অন্যান্য চাকরির শর্ত প্রযোজ্য আইন এবং লিখিত কোম্পানি নীতিমালা অনুযায়ী পরিচালিত হবে।`,
        "আমি আমার নামে প্রদত্ত OMS/অফিস অ্যাকাউন্ট কেবল নিজের দায়িত্ব পালনের জন্য ব্যবহার করব এবং পাসওয়ার্ড বা অ্যাক্সেস অন্য কারও সঙ্গে শেয়ার করব না।",
      ]
        .map(paragraph)
        .join(""),
    },
    {
      title: "দীর্ঘমেয়াদি নিয়োগপত্র",
      subtitle: `${formatBangladeshDate(contractStart)} থেকে কার্যকর`,
      bodyHtml: [
        `Trendy Deals BD-এ আপনার ১৫ দিনের প্রাথমিক মূল্যায়ন সন্তোষজনক হওয়ায় আপনাকে ${profile.designation} পদে দীর্ঘমেয়াদি ভিত্তিতে নিয়োগ প্রদান করা হলো। যোগদানের কার্যকর তারিখ ${formatBangladeshDate(joinDate)}।`,
        `মূল বেতন: ${money(profile.baseSalary)}। পারফরম্যান্স, দায়িত্ব, ব্যবসায়িক প্রয়োজন ও পারস্পরিক লিখিত সমঝোতার ভিত্তিতে কোম্পানি বেতন বৃদ্ধি বা পুনর্নির্ধারণের প্রস্তাব দিতে পারে; কোনো পরিবর্তন প্রযোজ্য আইন ও লিখিত নোটিশের সঙ্গে সামঞ্জস্য রেখে কার্যকর হবে।`,
        `কর্মীকে নিজের প্রধান দায়িত্বের পাশাপাশি অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজন অনুযায়ী সংশ্লিষ্ট কাজে অংশ নিতে হবে। কর্মঘণ্টা, বিরতি, ছুটি ও অতিরিক্ত কাজ প্রযোজ্য আইন ও প্রকাশিত রোস্টার অনুসারে হবে। OMS-এ Work Off সাধারণত ${profile.workOffDeadline} এর মধ্যে সম্পন্ন করতে হবে।`,
        "গ্রাহক, পণ্য, সোর্সিং, মূল্য, সরবরাহকারী, বিজ্ঞাপন, সফটওয়্যার, রিপোর্ট, ব্যবসায়িক পরিকল্পনা ও অন্য সব গোপনীয় তথ্য চাকরির সময় এবং চাকরি শেষ হওয়ার পরও অনুমতি ছাড়া ব্যবহার বা প্রকাশ করা যাবে না।",
        "চাকরি সমাপ্তি, পদত্যাগ, শৃঙ্খলামূলক ব্যবস্থা, বেতন কর্তন বা পাওনা নিষ্পত্তির ক্ষেত্রে প্রযোজ্য আইন ও কোম্পানির অনুমোদিত নীতিমালা অনুসরণ করা হবে।",
      ]
        .map(paragraph)
        .join(""),
    },
    {
      title: "৬ মাসের কর্মসংস্থান ও গোপনীয়তা চুক্তি",
      subtitle: `${formatBangladeshDate(contractStart)} - ${formatBangladeshDate(contractEnd)}`,
      witness: true,
      bodyHtml: clauses([
        `১. এই চুক্তির কার্যকাল ${formatBangladeshDate(contractStart)} থেকে ${formatBangladeshDate(contractEnd)} পর্যন্ত ৬ মাস। এই সময় উভয় পক্ষ সৎ বিশ্বাসে কর্মসম্পর্ক বজায় রাখবে।`,
        "২. কর্মী তার নির্ধারিত পদ ও সংশ্লিষ্ট দায়িত্ব যথাযথভাবে পালন করবেন এবং অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজনে সংশ্লিষ্ট কাজে সহযোগিতা করবেন।",
        "৩. কর্মঘণ্টা, বিরতি, ছুটি, অতিরিক্ত কাজ, হাজিরা ও Work Off প্রযোজ্য আইন, অফিস রোস্টার ও OMS Attendance নীতিমালা অনুযায়ী হবে।",
        "৪. গ্রাহক তথ্য, পণ্য তথ্য, সোর্সিং, সরবরাহকারী, ক্রয়মূল্য, স্টক, অর্ডার, কুরিয়ার, বিজ্ঞাপন, রিপোর্ট, সফটওয়্যার, পাসওয়ার্ড ও ব্যবসায়িক কৌশল কঠোরভাবে গোপন রাখতে হবে।",
        "৫. চাকরি চলাকালে বা চাকরি শেষ হওয়ার পরে গোপনীয় তথ্য কপি, নিজের ব্যবসায় ব্যবহার, তৃতীয় পক্ষকে দেওয়া, বিক্রি বা প্রকাশ করা যাবে না; আইনগতভাবে গোপনীয় থাকা পর্যন্ত এই বাধ্যবাধকতা বহাল থাকবে।",
        "৬. কর্মী কোম্পানির ডিভাইস, নথি, আইডি, লগইন, কাস্টমার ডেটা ও অন্যান্য সম্পদ চাকরি শেষের সময় ফেরত/হস্তান্তর করবেন।",
        `৭. কর্মী ৬ মাস পূর্ণ হওয়ার আগে চাকরি ছাড়তে চাইলে প্রযোজ্য নোটিশ, প্রকৃত ও নথিভুক্ত প্রশিক্ষণ/প্রতিস্থাপন ব্যয় বা আইনসম্মত অন্যান্য সমন্বয়ের ভিত্তিতে কোম্পানি সর্বোচ্চ ${money(profile.earlyExitSettlementLimit)} পর্যন্ত দাবি বিবেচনা করতে পারে। এটি স্বয়ংক্রিয় জরিমানা নয়; প্রযোজ্য আইন, প্রকৃত ক্ষতি/ব্যয় ও ন্যায়সংগত প্রক্রিয়া সাপেক্ষে হবে এবং কোম্পানি সম্পূর্ণ বা আংশিকভাবে মওকুফ করতে পারবে।`,
        "৮. কোম্পানি প্রয়োজনবোধে বেতন, দায়িত্ব বা পদ পরিবর্তনের প্রস্তাব দিতে পারে; তা লিখিতভাবে জানাতে হবে এবং প্রযোজ্য আইন ও পারস্পরিক চুক্তির সঙ্গে সামঞ্জস্যপূর্ণ হতে হবে।",
        "৯. অসদাচরণ, অনুপস্থিতি, দেরি, বিরতি অতিক্রম বা নীতি ভঙ্গের জন্য ব্যবস্থা নেওয়া যেতে পারে; তবে কোনো আর্থিক কর্তন বা চাকরি সমাপ্তি আইন ও যথাযথ প্রক্রিয়া অনুসারে হবে।",
        "১০. কোনো ধারা প্রযোজ্য আইনের সঙ্গে অসামঞ্জস্যপূর্ণ হলে আইন অগ্রাধিকার পাবে এবং বাকি ধারাসমূহ কার্যকর থাকবে।",
      ]),
    },
  ];

  return renderPdf(await buildHtml(profile, blocks));
}

export async function createTerminationLetter(profile: EmploymentPdfProfile) {
  const terminationDate = profile.terminationDate || new Date();
  const blocks: DocumentBlock[] = [
    {
      title: "চাকরি সমাপ্তির পত্র",
      subtitle: formatBangladeshDate(terminationDate),
      bodyHtml: [
        `এই মর্মে জানানো যাচ্ছে যে, Trendy Deals BD-এ আপনার ${profile.designation} পদে কর্মসম্পর্ক ${formatBangladeshDate(terminationDate)} তারিখ থেকে সমাপ্ত করা হয়েছে/হবে।`,
        `কারণ: ${profile.terminationReason || "প্রশাসনিক সিদ্ধান্ত"}`,
        "চাকরি সমাপ্তির সঙ্গে সঙ্গে OMS ও অন্যান্য অফিসিয়াল অ্যাক্সেস নিষ্ক্রিয় করা হবে। কোম্পানির ডিভাইস, নথি, আইডি, পাসওয়ার্ড/অ্যাক্সেস, গ্রাহক তথ্য ও অন্যান্য সম্পদ হস্তান্তর করতে হবে।",
        "চাকরি শেষ হলেও গ্রাহক, পণ্য, সোর্সিং, ব্যবসায়িক তথ্য ও অন্যান্য গোপনীয় তথ্য সম্পর্কিত গোপনীয়তার বাধ্যবাধকতা বহাল থাকবে। বকেয়া পাওনা বা সমন্বয় প্রযোজ্য আইন ও রেকর্ড অনুযায়ী নিষ্পত্তি করা হবে।",
      ]
        .map(paragraph)
        .join(""),
    },
  ];

  return renderPdf(await buildHtml(profile, blocks));
}
