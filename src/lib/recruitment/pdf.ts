import { PageSizes, type PDFFont, type PDFPage } from "pdf-lib";
import { createFinancePdf, drawBusinessHeader, drawWrappedText, PDF_COLORS } from "@/lib/finance/pdf";
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

const A4: [number, number] = [PageSizes.A4[0], PageSizes.A4[1]];
const MARGIN = 42;

function money(value: number) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function drawLabelValue(page: PDFPage, font: PDFFont, y: number, label: string, value: string) {
  page.drawText(`${label}:`, { x: MARGIN, y, size: 9.5, font, color: PDF_COLORS.muted });
  drawWrappedText({ page, font, text: value || "-", x: 150, y, maxWidth: A4[0] - 150 - MARGIN, size: 9.5, lineHeight: 12 });
  return y - 15;
}

function drawParagraph(page: PDFPage, font: PDFFont, y: number, text: string, size = 10.2) {
  const result = drawWrappedText({
    page,
    font,
    text,
    x: MARGIN,
    y,
    maxWidth: A4[0] - MARGIN * 2,
    size,
    lineHeight: 15,
  });
  return y - result.height - 8;
}

function addDocPage(pdfDoc: any, font: PDFFont, title: string, subtitle?: string) {
  const page = pdfDoc.addPage(A4);
  const y = drawBusinessHeader({
    page,
    font,
    title,
    subtitle,
    pageWidth: A4[0],
    topY: A4[1] - 38,
  });
  return { page, y };
}

function drawStaffIdentity(page: PDFPage, font: PDFFont, profile: EmploymentPdfProfile, startY: number) {
  let y = startY;
  y = drawLabelValue(page, font, y, "নাম", profile.user.name);
  y = drawLabelValue(page, font, y, "পিতার নাম", profile.fatherName);
  y = drawLabelValue(page, font, y, "পদবী", profile.designation);
  y = drawLabelValue(page, font, y, "মোবাইল", profile.phone);
  y = drawLabelValue(page, font, y, "জাতীয় পরিচয়পত্র", profile.nidNumber);
  y = drawLabelValue(page, font, y, "ঠিকানা", profile.address);
  page.drawLine({ start: { x: MARGIN, y: y - 2 }, end: { x: A4[0] - MARGIN, y: y - 2 }, thickness: 0.7, color: PDF_COLORS.border });
  return y - 20;
}

function drawSignatures(page: PDFPage, font: PDFFont, y: number, includeWitness = false) {
  const cols = includeWitness ? 3 : 2;
  const gap = 18;
  const width = (A4[0] - MARGIN * 2 - gap * (cols - 1)) / cols;
  const labels = includeWitness ? ["কর্মীর স্বাক্ষর", "কোম্পানির পক্ষে", "সাক্ষী"] : ["কর্মীর স্বাক্ষর", "কোম্পানির পক্ষে"];
  labels.forEach((label, idx) => {
    const x = MARGIN + idx * (width + gap);
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.7, color: PDF_COLORS.border });
    page.drawText(label, { x, y: y - 15, size: 8.7, font, color: PDF_COLORS.muted });
  });
}

export async function createProbationPacket(profile: EmploymentPdfProfile) {
  const { pdfDoc, font } = await createFinancePdf();

  {
    const { page, y: initialY } = addDocPage(pdfDoc, font, "১৫ দিনের প্রাথমিক নিয়োগপত্র", `${formatBangladeshDate(profile.probationStartDate)} - ${formatBangladeshDate(profile.probationEndDate)}`);
    let y = drawStaffIdentity(page, font, profile, initialY);
    y = drawParagraph(page, font, y, `প্রিয় ${profile.user.name}, Trendy Deals BD-এ ${profile.designation} পদে আপনাকে ১৫ দিনের প্রাথমিক মূল্যায়ন/শিক্ষানবিশ পর্যায়ে নিয়োগ প্রদান করা হলো। এই সময়কাল ${formatBangladeshDate(profile.probationStartDate)} থেকে ${formatBangladeshDate(profile.probationEndDate)} পর্যন্ত কার্যকর থাকবে।`);
    y = drawParagraph(page, font, y, `স্থায়ী নিয়োগের জন্য প্রস্তাবিত মূল বেতন ${money(profile.baseSalary)}। প্রাথমিক সময়ের নির্ধারিত ভাতা/পারিশ্রমিক ${money(profile.probationCompensation)}; তবে প্রযোজ্য আইন অনুযায়ী কোনো মজুরি, ভাতা বা অন্য পাওনা প্রদেয় হলে আইনই অগ্রাধিকার পাবে।`);
    y = drawParagraph(page, font, y, `কর্মীকে তার নির্ধারিত দায়িত্বের পাশাপাশি অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজনে অর্পিত অন্যান্য কাজে সহযোগিতা করতে হবে। দৈনিক কাজের সময়, বিরতি, সাপ্তাহিক ছুটি ও অতিরিক্ত কাজ প্রযোজ্য আইন, প্রকাশিত রোস্টার এবং কোম্পানির নীতিমালা অনুযায়ী পরিচালিত হবে। OMS-এ দৈনিক Work Off সর্বোচ্চ ${profile.workOffDeadline} এর মধ্যে সম্পন্ন করতে হবে, যদি না অনুমোদিত রোস্টার বা দায়িত্ব ভিন্ন কিছু নির্ধারণ করে।`);
    y = drawParagraph(page, font, y, `ইভিনিং ব্রেকের নির্ধারিত সময় ${profile.eveningBreakMinutes} মিনিট। দেরিতে উপস্থিতি, অনুমোদন ছাড়া অনুপস্থিতি বা বিরতির সময় অতিক্রম করলে তা উপস্থিতি লঙ্ঘন হিসেবে নথিভুক্ত হতে পারে। কোনো আর্থিক কর্তন বা জরিমানা কেবল প্রযোজ্য আইন ও অনুমোদিত নীতিমালা অনুসারে করা যাবে।`);
    y = drawParagraph(page, font, y, `এই ১৫ দিনের শেষে উভয় পক্ষ কাজের উপযোগিতা, আচরণ, গোপনীয়তা রক্ষা, উপস্থিতি ও পারফরম্যান্স বিবেচনা করবে। সন্তোষজনক হলে স্থায়ী নিয়োগের জন্য পৃথক যোগদানপত্র, নিয়োগপত্র ও চুক্তি প্রদান করা হবে; অন্যথায় প্রযোজ্য আইন ও নীতিমালা অনুযায়ী সম্পর্ক সমাপ্ত করা যেতে পারে।`);
    drawSignatures(page, font, Math.max(80, y - 30));
  }

  {
    const { page, y: initialY } = addDocPage(pdfDoc, font, "১৫ দিনের গোপনীয়তা ও দায়িত্ব চুক্তি", "Trendy Deals BD");
    let y = drawStaffIdentity(page, font, profile, initialY);
    const clauses = [
      "১. কর্মী সততা, শৃঙ্খলা ও দায়িত্বশীলতার সঙ্গে অর্পিত কাজ সম্পন্ন করবেন এবং অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজন অনুযায়ী সহযোগিতা করবেন।",
      `২. উপস্থিতি, অফিস রোস্টার, অনুমোদিত বিরতি ও OMS Attendance নিয়ম অনুসরণ করতে হবে। ইভিনিং ব্রেক ${profile.eveningBreakMinutes} মিনিটের বেশি হলে বা নির্ধারিত সময়ে উপস্থিত না হলে তা লঙ্ঘন হিসেবে নথিভুক্ত হতে পারে।`,
      "৩. গ্রাহকের নাম, ফোন নম্বর, ঠিকানা, অর্ডার, পেমেন্ট, কুরিয়ার, অভিযোগ বা অন্য কোনো গ্রাহক-তথ্য কেবল অনুমোদিত অফিসিয়াল কাজে ব্যবহার করা যাবে।",
      "৪. পণ্যের সোর্স, ক্রয়মূল্য, সরবরাহকারী, SKU, স্টক, বিজ্ঞাপন ডেটা, ব্যবসায়িক কৌশল, সফটওয়্যার লগইন, রিপোর্ট, ডাটাবেস বা অন্য কোনো সংবেদনশীল তথ্য কারও সঙ্গে শেয়ার, কপি, বিক্রি বা ব্যক্তিগত কাজে ব্যবহার করা যাবে না।",
      "৫. গোপনীয়তার বাধ্যবাধকতা চাকরির সময় এবং চাকরি/চুক্তি শেষ হওয়ার পরও প্রযোজ্য থাকবে, যতদিন তথ্যটি আইনসঙ্গতভাবে গোপনীয় থাকে।",
      "৬. অফিসের ডিভাইস, অ্যাকাউন্ট, পাসওয়ার্ড, নথি ও সম্পদ নিরাপদ রাখতে হবে এবং অনুমতি ছাড়া বহিরাগত ব্যক্তি বা ব্যক্তিগত প্ল্যাটফর্মে ব্যবহার করা যাবে না।",
      "৭. বেতন, দায়িত্ব বা পদে পরিবর্তন লিখিতভাবে জানানো হবে এবং প্রযোজ্য আইন ও পারস্পরিক চুক্তির সঙ্গে সামঞ্জস্য রেখে কার্যকর করা হবে।",
      "৮. কোনো শৃঙ্খলামূলক ব্যবস্থা, বেতন কর্তন, ক্ষতিপূরণ বা চাকরি সমাপ্তির ক্ষেত্রে প্রযোজ্য আইন, ন্যায়সংগত প্রক্রিয়া এবং কোম্পানির অনুমোদিত নীতিমালা অনুসরণ করা হবে।",
      "৯. ১৫ দিনের মূল্যায়ন শেষে স্থায়ী নিয়োগ স্বয়ংক্রিয় নয়; উভয় পক্ষের উপযোগিতা ও প্রযোজ্য আইন অনুযায়ী পরবর্তী সিদ্ধান্ত নেওয়া হবে।",
    ];
    for (const clause of clauses) y = drawParagraph(page, font, y, clause, 9.7);
    drawSignatures(page, font, Math.max(70, y - 22), true);
  }

  return pdfDoc.save();
}

export async function createPermanentPacket(profile: EmploymentPdfProfile) {
  const { pdfDoc, font } = await createFinancePdf();
  const joinDate = profile.permanentJoinDate || profile.agreementStartDate || new Date();
  const contractStart = profile.agreementStartDate || joinDate;
  const contractEnd = profile.agreementEndDate || joinDate;

  {
    const { page, y: initialY } = addDocPage(pdfDoc, font, "যোগদানপত্র", formatBangladeshDate(joinDate));
    let y = drawStaffIdentity(page, font, profile, initialY);
    y = drawParagraph(page, font, y, `আমি, ${profile.user.name}, Trendy Deals BD-এ ${profile.designation} পদে ${formatBangladeshDate(joinDate)} তারিখে যোগদান করছি। প্রতিষ্ঠানের বৈধ নীতিমালা, দায়িত্ব, উপস্থিতি, তথ্য-নিরাপত্তা ও গোপনীয়তার শর্তসমূহ মেনে দায়িত্ব পালনের অঙ্গীকার করছি।`);
    y = drawParagraph(page, font, y, `আমার নির্ধারিত মূল বেতন ${money(profile.baseSalary)}। বেতন, ভাতা, ছুটি, কর্মঘণ্টা ও অন্যান্য চাকরির শর্ত প্রযোজ্য আইন এবং লিখিত কোম্পানি নীতিমালা অনুযায়ী পরিচালিত হবে।`);
    y = drawParagraph(page, font, y, "আমি আমার নামে প্রদত্ত OMS/অফিস অ্যাকাউন্ট কেবল নিজের দায়িত্ব পালনের জন্য ব্যবহার করব এবং পাসওয়ার্ড বা অ্যাক্সেস অন্য কারও সঙ্গে শেয়ার করব না।");
    drawSignatures(page, font, Math.max(110, y - 40));
  }

  {
    const { page, y: initialY } = addDocPage(pdfDoc, font, "দীর্ঘমেয়াদি নিয়োগপত্র", `${formatBangladeshDate(contractStart)} থেকে কার্যকর`);
    let y = drawStaffIdentity(page, font, profile, initialY);
    y = drawParagraph(page, font, y, `Trendy Deals BD-এ আপনার ১৫ দিনের প্রাথমিক মূল্যায়ন সন্তোষজনক হওয়ায় আপনাকে ${profile.designation} পদে দীর্ঘমেয়াদি ভিত্তিতে নিয়োগ প্রদান করা হলো। যোগদানের কার্যকর তারিখ ${formatBangladeshDate(joinDate)}।`);
    y = drawParagraph(page, font, y, `মূল বেতন: ${money(profile.baseSalary)}। পারফরম্যান্স, দায়িত্ব, ব্যবসায়িক প্রয়োজন ও পারস্পরিক লিখিত সমঝোতার ভিত্তিতে কোম্পানি বেতন বৃদ্ধি বা পুনর্নির্ধারণের প্রস্তাব দিতে পারে; কোনো পরিবর্তন প্রযোজ্য আইন ও লিখিত নোটিশের সঙ্গে সামঞ্জস্য রেখে কার্যকর হবে।`);
    y = drawParagraph(page, font, y, `কর্মীকে নিজের প্রধান দায়িত্বের পাশাপাশি অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজন অনুযায়ী সংশ্লিষ্ট কাজে অংশ নিতে হবে। কর্মঘণ্টা, বিরতি, ছুটি ও অতিরিক্ত কাজ প্রযোজ্য আইন ও প্রকাশিত রোস্টার অনুসারে হবে। OMS-এ Work Off সাধারণত ${profile.workOffDeadline} এর মধ্যে সম্পন্ন করতে হবে।`);
    y = drawParagraph(page, font, y, "গ্রাহক, পণ্য, সোর্সিং, মূল্য, সরবরাহকারী, বিজ্ঞাপন, সফটওয়্যার, রিপোর্ট, ব্যবসায়িক পরিকল্পনা ও অন্য সব গোপনীয় তথ্য চাকরির সময় এবং চাকরি শেষ হওয়ার পরও অনুমতি ছাড়া ব্যবহার বা প্রকাশ করা যাবে না।");
    y = drawParagraph(page, font, y, "চাকরি সমাপ্তি, পদত্যাগ, শৃঙ্খলামূলক ব্যবস্থা, বেতন কর্তন বা পাওনা নিষ্পত্তির ক্ষেত্রে প্রযোজ্য আইন ও কোম্পানির অনুমোদিত নীতিমালা অনুসরণ করা হবে।");
    drawSignatures(page, font, Math.max(80, y - 30));
  }

  {
    const { page, y: initialY } = addDocPage(pdfDoc, font, "৬ মাসের কর্মসংস্থান ও গোপনীয়তা চুক্তি", `${formatBangladeshDate(contractStart)} - ${formatBangladeshDate(contractEnd)}`);
    let y = drawStaffIdentity(page, font, profile, initialY);
    const clauses = [
      `১. এই চুক্তির কার্যকাল ${formatBangladeshDate(contractStart)} থেকে ${formatBangladeshDate(contractEnd)} পর্যন্ত ৬ মাস। এই সময় উভয় পক্ষ সৎ বিশ্বাসে কর্মসম্পর্ক বজায় রাখবে।`,
      "২. কর্মী তার নির্ধারিত পদ ও সংশ্লিষ্ট দায়িত্ব যথাযথভাবে পালন করবেন এবং অফিসের যুক্তিসঙ্গত ও বৈধ প্রয়োজনে সংশ্লিষ্ট কাজে সহযোগিতা করবেন।",
      "৩. কর্মঘণ্টা, বিরতি, ছুটি, অতিরিক্ত কাজ, হাজিরা ও Work Off প্রযোজ্য আইন, অফিস রোস্টার ও OMS Attendance নীতিমালা অনুযায়ী হবে।",
      "৪. গ্রাহক তথ্য, পণ্য তথ্য, সোর্সিং, সরবরাহকারী, ক্রয়মূল্য, স্টক, অর্ডার, কুরিয়ার, বিজ্ঞাপন, রিপোর্ট, সফটওয়্যার, পাসওয়ার্ড ও ব্যবসায়িক কৌশল কঠোরভাবে গোপন রাখতে হবে।",
      "৫. চাকরি চলাকালে বা চাকরি শেষ হওয়ার পরে গোপনীয় তথ্য কপি, নিজের ব্যবসায় ব্যবহার, তৃতীয় পক্ষকে দেওয়া, বিক্রি বা প্রকাশ করা যাবে না; আইনগতভাবে গোপনীয় থাকা পর্যন্ত এই বাধ্যবাধকতা বহাল থাকবে।",
      "৬. কর্মী কোম্পানির ডিভাইস, নথি, আইডি, লগইন, কাস্টমার ডেটা ও অন্যান্য সম্পদ চাকরি শেষের সময় ফেরত/হস্তান্তর করবেন।",
      `৭. কর্মী ৬ মাস পূর্ণ হওয়ার আগে চাকরি ছাড়তে চাইলে প্রযোজ্য নোটিশ, প্রকৃত ও নথিভুক্ত প্রশিক্ষণ/প্রতিস্থাপন ব্যয় বা আইনসম্মত অন্যান্য সমন্বয়ের ভিত্তিতে কোম্পানি সর্বোচ্চ ${money(profile.earlyExitSettlementLimit)} পর্যন্ত দাবি বিবেচনা করতে পারে। এটি স্বয়ংক্রিয় জরিমানা নয়; প্রযোজ্য আইন, প্রকৃত ক্ষতি/ব্যয় ও ন্যায়সংগত প্রক্রিয়া সাপেক্ষে হবে এবং কোম্পানি সম্পূর্ণ বা আংশিকভাবে মওকুফ করতে পারবে।`,
      "৮. কোম্পানি প্রয়োজনবোধে বেতন, দায়িত্ব বা পদ পরিবর্তনের প্রস্তাব দিতে পারে; তা লিখিতভাবে জানাতে হবে এবং প্রযোজ্য আইন ও পারস্পরিক চুক্তির সঙ্গে সামঞ্জস্যপূর্ণ হতে হবে।",
      "৯. অসদাচরণ, অনুপস্থিতি, দেরি, বিরতি অতিক্রম বা নীতি ভঙ্গের জন্য ব্যবস্থা নেওয়া যেতে পারে; তবে কোনো আর্থিক কর্তন বা চাকরি সমাপ্তি আইন ও যথাযথ প্রক্রিয়া অনুসারে হবে।",
      "১০. কোনো ধারা প্রযোজ্য আইনের সঙ্গে অসামঞ্জস্যপূর্ণ হলে আইন অগ্রাধিকার পাবে এবং বাকি ধারাসমূহ কার্যকর থাকবে।",
    ];
    for (const clause of clauses) y = drawParagraph(page, font, y, clause, 9.4);
    drawSignatures(page, font, Math.max(65, y - 20), true);
  }

  return pdfDoc.save();
}

export async function createTerminationLetter(profile: EmploymentPdfProfile) {
  const { pdfDoc, font } = await createFinancePdf();
  const terminationDate = profile.terminationDate || new Date();
  const { page, y: initialY } = addDocPage(pdfDoc, font, "চাকরি সমাপ্তির পত্র", formatBangladeshDate(terminationDate));
  let y = drawStaffIdentity(page, font, profile, initialY);
  y = drawParagraph(page, font, y, `এই মর্মে জানানো যাচ্ছে যে, Trendy Deals BD-এ আপনার ${profile.designation} পদে কর্মসম্পর্ক ${formatBangladeshDate(terminationDate)} তারিখ থেকে সমাপ্ত করা হয়েছে/হবে।`);
  y = drawParagraph(page, font, y, `কারণ: ${profile.terminationReason || "প্রশাসনিক সিদ্ধান্ত"}`);
  y = drawParagraph(page, font, y, "চাকরি সমাপ্তির সঙ্গে সঙ্গে OMS ও অন্যান্য অফিসিয়াল অ্যাক্সেস নিষ্ক্রিয় করা হবে। কোম্পানির ডিভাইস, নথি, আইডি, পাসওয়ার্ড/অ্যাক্সেস, গ্রাহক তথ্য ও অন্যান্য সম্পদ হস্তান্তর করতে হবে।");
  y = drawParagraph(page, font, y, "চাকরি শেষ হলেও গ্রাহক, পণ্য, সোর্সিং, ব্যবসায়িক তথ্য ও অন্যান্য গোপনীয় তথ্য সম্পর্কিত গোপনীয়তার বাধ্যবাধকতা বহাল থাকবে। বকেয়া পাওনা বা সমন্বয় প্রযোজ্য আইন ও রেকর্ড অনুযায়ী নিষ্পত্তি করা হবে।");
  drawSignatures(page, font, Math.max(100, y - 35));
  return pdfDoc.save();
}
