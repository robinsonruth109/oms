import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact & Support",
  description: `Contact ${siteConfig.name} customer support, operated by Trendy Deal BD.`,
  alternates: {
    canonical: "/contact",
  },
};

const LAST_UPDATED = "August 8, 2026";

function SupportSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold tracking-tight text-slate-950">
        {title}
      </h2>

      <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function ContactPage() {
  return (
    <article className="space-y-9">
      <header className="space-y-4 border-b border-slate-200 pb-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Gloss & Glows
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Contact & Customer Support
          </h1>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Contact Gloss & Glows for questions about products, orders,
          delivery, returns, privacy, data deletion, or our website and
          mobile applications.
        </p>

        <p className="text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <SupportSection title="1. Business Information">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <dl className="grid gap-4 text-sm sm:text-base">
            <div>
              <dt className="font-semibold text-slate-950">
                Brand
              </dt>
              <dd className="mt-1">Gloss & Glows</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Operated by
              </dt>
              <dd className="mt-1">Trendy Deal BD</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Website
              </dt>
              <dd className="mt-1">
                <a
                  href="https://glossandglows.com"
                  className="font-medium text-slate-950 underline underline-offset-4"
                >
                  https://glossandglows.com
                </a>
              </dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Address
              </dt>
              <dd className="mt-1">
                37/2, Lane-1, Block-A, Section-6
                <br />
                Mirpur, Dhaka
                <br />
                Bangladesh
              </dd>
            </div>
          </dl>
        </div>
      </SupportSection>

      <SupportSection title="2. Customer Support Email">
        <p>
          For general support, order questions, returns, delivery
          problems, privacy questions, or mobile-app support, email:
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <a
            href="mailto:trendysarverbd@gmail.com"
            className="break-all text-lg font-bold text-slate-950 underline underline-offset-4"
          >
            trendysarverbd@gmail.com
          </a>
        </div>

        <p>
          Please include enough information for us to identify the
          relevant order or issue.
        </p>
      </SupportSection>

      <SupportSection title="3. Customer Support Phone">
        <p>
          You can also contact Gloss & Glows by phone:
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <a
            href="tel:+8801303559063"
            className="text-lg font-bold text-slate-950 underline underline-offset-4"
          >
            +8801303559063
          </a>
        </div>

        <p>
          Phone availability may depend on normal business operations
          and customer-support workload.
        </p>
      </SupportSection>

      <SupportSection title="4. Order Support">
        <p>
          If you are contacting us about an existing order, please
          provide as much of the following information as you have:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Your name used on the order.</li>
          <li>Your mobile number used on the order.</li>
          <li>Your order or invoice number, if available.</li>
          <li>The approximate order date.</li>
          <li>
            A short description of the question or problem.
          </li>
        </ul>

        <p>
          This helps us find the correct order and respond more
          efficiently.
        </p>
      </SupportSection>

      <SupportSection title="5. Damaged or Wrong Product">
        <p>
          Damaged, defective, incomplete, or incorrect-product issues
          should be reported within 24 hours of receiving the parcel.
        </p>

        <p>
          Please keep the product, original packaging, courier packet,
          invoice or order information, and relevant evidence.
        </p>

        <p>
          We may request:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Unboxing video.</li>
          <li>Product photographs.</li>
          <li>Courier-packet photographs.</li>
          <li>Original packaging.</li>
          <li>Invoice or order information.</li>
        </ul>

        <p>
          Full conditions are available in our{" "}
          <Link
            href="/refund-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Refund & Return Policy
          </Link>
          .
        </p>
      </SupportSection>

      <SupportSection title="6. Delivery Questions">
        <p>
          For delivery-related support, please provide your order
          information and the phone number used when placing the order.
        </p>

        <p>
          Our current checkout supports delivery addresses inside and
          outside Dhaka, subject to courier coverage and operational
          availability.
        </p>

        <p>
          For more information, review our{" "}
          <Link
            href="/shipping-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Shipping Policy
          </Link>
          .
        </p>
      </SupportSection>

      <SupportSection title="7. Return, Replacement, Exchange, or Refund">
        <p>
          To request an eligible return, replacement, exchange, or
          refund, contact us using the email address or phone number
          listed on this page.
        </p>

        <p>
          Change-of-mind returns may be accepted when the applicable
          conditions are met, but the customer is responsible for the
          applicable delivery or return courier charges.
        </p>

        <p>
          Where Gloss & Glows verifies that an incorrect, damaged, or
          defective product was supplied through our error, Gloss &
          Glows will bear the reasonable eligible return courier cost.
        </p>
      </SupportSection>

      <SupportSection title="8. Privacy Questions">
        <p>
          For questions regarding how Gloss & Glows collects, uses,
          shares, protects, or retains personal information, contact:
        </p>

        <p>
          <a
            href="mailto:trendysarverbd@gmail.com?subject=Gloss%20%26%20Glows%20Privacy%20Question"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            trendysarverbd@gmail.com
          </a>
        </p>

        <p>
          You can also review our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </SupportSection>

      <SupportSection title="9. Data Deletion Requests">
        <p>
          Eligible early data-deletion requests can be submitted by
          email.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-950">
            Data deletion request
          </p>

          <p className="mt-2">
            <a
              href="mailto:trendysarverbd@gmail.com?subject=Gloss%20%26%20Glows%20Data%20Deletion%20Request"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              trendysarverbd@gmail.com
            </a>
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Suggested subject: Gloss & Glows Data Deletion Request
          </p>
        </div>

        <p>
          Full instructions are available on our{" "}
          <Link
            href="/data-deletion"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Data Deletion page
          </Link>
          .
        </p>
      </SupportSection>

      <SupportSection title="10. Mobile Application Support">
        <p>
          This support channel also covers the official Gloss & Glows
          Android and iOS applications.
        </p>

        <p>
          If you report an application problem, it is helpful to
          include:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Whether you use Android or iPhone.</li>
          <li>Your app version, if visible.</li>
          <li>A description of what happened.</li>
          <li>A screenshot where appropriate.</li>
          <li>
            The product or page involved if the issue concerns a
            specific product.
          </li>
        </ul>
      </SupportSection>

      <SupportSection title="11. Security">
        <p>
          Gloss & Glows customer support will never need your banking
          password, mobile-financial-service PIN, device unlock code,
          or one-time password solely to investigate a normal shopping
          support request.
        </p>

        <p>
          Do not send passwords, PINs, OTP codes, or other sensitive
          authentication credentials through email or ordinary
          customer-support messages.
        </p>

        <p>
          If someone claims to represent Gloss & Glows and requests
          sensitive credentials unexpectedly, verify the request
          through the official contact information on this page.
        </p>
      </SupportSection>

      <SupportSection title="12. Official Contact Details">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-bold text-slate-950">
            Trendy Deal BD / Gloss & Glows
          </p>

          <p className="mt-2">
            37/2, Lane-1, Block-A, Section-6
            <br />
            Mirpur, Dhaka
            <br />
            Bangladesh
          </p>

          <p className="mt-3">
            Email:{" "}
            <a
              href="mailto:trendysarverbd@gmail.com"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              trendysarverbd@gmail.com
            </a>
          </p>

          <p>
            Phone:{" "}
            <a
              href="tel:+8801303559063"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              +8801303559063
            </a>
          </p>
        </div>
      </SupportSection>

      <SupportSection title="13. Related Policies">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/privacy"
            className="rounded-2xl border border-slate-200 p-4 font-semibold text-slate-950 transition hover:bg-slate-50"
          >
            Privacy Policy
          </Link>

          <Link
            href="/terms"
            className="rounded-2xl border border-slate-200 p-4 font-semibold text-slate-950 transition hover:bg-slate-50"
          >
            Terms & Conditions
          </Link>

          <Link
            href="/shipping-policy"
            className="rounded-2xl border border-slate-200 p-4 font-semibold text-slate-950 transition hover:bg-slate-50"
          >
            Shipping Policy
          </Link>

          <Link
            href="/refund-policy"
            className="rounded-2xl border border-slate-200 p-4 font-semibold text-slate-950 transition hover:bg-slate-50"
          >
            Refund & Return Policy
          </Link>

          <Link
            href="/data-deletion"
            className="rounded-2xl border border-slate-200 p-4 font-semibold text-slate-950 transition hover:bg-slate-50"
          >
            Data Deletion
          </Link>
        </div>
      </SupportSection>
    </article>
  );
}