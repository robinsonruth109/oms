
import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Refund & Return Policy",
  description: `Refund, return, replacement, and exchange policy for ${siteConfig.name}, operated by Trendy Deal BD.`,
  alternates: {
    canonical: "/refund-policy",
  },
};

const LAST_UPDATED = "August 8, 2026";

function PolicySection({
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

export default function RefundPolicyPage() {
  return (
    <article className="space-y-9">
      <header className="space-y-4 border-b border-slate-200 pb-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Gloss & Glows
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Refund & Return Policy
          </h1>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          This policy explains when a product purchased from Gloss &
          Glows may qualify for a return, replacement, exchange, or
          refund and what information is required to review a claim.
        </p>

        <p className="text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <PolicySection title="1. About This Policy">
        <p>
          Gloss & Glows is operated by Trendy Deal BD in Bangladesh.
          This policy applies to eligible physical products purchased
          directly through our official website or official Gloss &
          Glows mobile applications.
        </p>

        <p>
          Return and refund requests are reviewed according to the
          condition of the product, the reason for the request,
          available evidence, product type, and the circumstances of
          the order.
        </p>
      </PolicySection>

      <PolicySection title="2. Damaged, Defective, or Incorrect Products">
        <p>
          If you receive a product that is damaged, defective,
          incomplete, or materially different from the product you
          ordered, you must contact Gloss & Glows within 24 hours of
          receiving the parcel.
        </p>

        <p>
          Requests submitted after the 24-hour reporting period may
          not be eligible unless there are exceptional circumstances
          that we agree to review.
        </p>

        <p>
          Please do not throw away the courier packaging, product
          packaging, accessories, invoice, or other order materials
          until the issue has been reviewed.
        </p>
      </PolicySection>

      <PolicySection title="3. Evidence Required">
        <p>
          To help us verify a damaged, incorrect, incomplete, or
          disputed delivery, we may require all relevant evidence,
          including:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>
            A clear unboxing video showing the parcel being opened.
          </li>
          <li>
            Clear photographs of the product and the reported issue.
          </li>
          <li>
            Photographs of the courier packet or external packaging.
          </li>
          <li>
            Photographs of the product&apos;s original packaging.
          </li>
          <li>
            Order, invoice, or identifying information that allows us
            to locate the purchase.
          </li>
          <li>
            Any other reasonable information needed to verify the
            claim.
          </li>
        </ul>

        <p>
          The evidence should clearly show the condition in which the
          parcel and product were received.
        </p>

        <p>
          A request may be rejected if the evidence is insufficient
          to reasonably verify the reported issue.
        </p>
      </PolicySection>

      <PolicySection title="4. Available Resolutions">
        <p>
          When an eligible claim is verified, Gloss & Glows may offer
          one or more of the following depending on the circumstances
          and product availability:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Replacement of the affected product.</li>
          <li>Exchange for an eligible alternative product.</li>
          <li>Refund of the eligible amount.</li>
        </ul>

        <p>
          The appropriate resolution will be determined after we
          review the order, evidence, product condition, stock
          availability, and customer preference where reasonably
          possible.
        </p>
      </PolicySection>

      <PolicySection title="5. Return Courier Cost for Our Error">
        <p>
          If Gloss & Glows verifies that the customer received a
          damaged, defective, incorrect, or otherwise eligible
          problematic product through no fault of the customer, Gloss
          & Glows will bear the reasonable eligible return courier
          cost.
        </p>

        <p>
          We may provide return instructions, arrange a courier
          collection where available, or provide another reasonable
          return process.
        </p>

        <p>
          Customers should follow the return instructions supplied by
          Gloss & Glows rather than independently sending a parcel
          through an unusually expensive service without prior
          approval.
        </p>
      </PolicySection>

      <PolicySection title="6. Change-of-Mind Returns">
        <p>
          Gloss & Glows may accept an eligible change-of-mind return
          where the customer received the correct product but later
          decides not to keep it.
        </p>

        <p>
          A change-of-mind return is subject to the product being
          eligible for return and remaining in an acceptable,
          unused, unopened, and resaleable condition where applicable.
        </p>

        <p>
          For an approved change-of-mind return, the customer is
          responsible for the applicable delivery and/or return courier
          charges.
        </p>

        <p>
          Original delivery charges already incurred may not be
          refundable when the return is solely because of a change of
          mind.
        </p>
      </PolicySection>

      <PolicySection title="7. Condition of Returned Products">
        <p>
          Unless the return is specifically related to a damaged or
          defective product, an eligible returned product should
          normally be:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Unused.</li>
          <li>Unwashed where applicable.</li>
          <li>Unopened where hygiene or product safety requires it.</li>
          <li>Free from customer-caused damage.</li>
          <li>
            Returned with the original product packaging where
            reasonably applicable.
          </li>
          <li>
            Returned with all accessories, components, labels, seals,
            manuals, gifts, or other included items where applicable.
          </li>
        </ul>

        <p>
          Products that are materially altered after delivery may not
          qualify for a change-of-mind return.
        </p>
      </PolicySection>

      <PolicySection title="8. Non-Returnable Products">
        <p>
          For hygiene, health, safety, resale, and product-integrity
          reasons, some products may not be eligible for return after
          they have been opened, used, or otherwise compromised.
        </p>

        <p>Examples may include:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Opened or used cosmetics.</li>
          <li>
            Opened or used personal-care or hygiene products.
          </li>
          <li>
            Products with broken hygiene or protective seals where the
            seal is relevant to safe resale.
          </li>
          <li>
            Products damaged, altered, stained, contaminated, or
            otherwise affected after delivery by the customer.
          </li>
          <li>
            Products missing important packaging, accessories,
            components, or included items.
          </li>
          <li>
            Clearance or final-sale products where the product page or
            promotion clearly states that the item is non-returnable.
          </li>
        </ul>

        <p>
          This non-returnable rule does not remove any mandatory rights
          that may apply when a product was genuinely defective,
          damaged on arrival, or supplied incorrectly.
        </p>
      </PolicySection>

      <PolicySection title="9. Cosmetics and Hygiene Products">
        <p>
          Because Gloss & Glows may sell beauty, cosmetic,
          personal-care, or hygiene-related products, additional
          product-integrity rules may apply.
        </p>

        <p>
          Once a cosmetic or hygiene product has been opened or used,
          a change-of-mind return will normally not be accepted because
          the product may no longer be safely resold.
        </p>

        <p>
          If such a product was already damaged, defective, incorrect,
          or otherwise problematic when delivered, contact us within
          24 hours and provide the required evidence so we can review
          the issue.
        </p>
      </PolicySection>

      <PolicySection title="10. Incorrect Product">
        <p>
          If Gloss & Glows sends a product materially different from
          the confirmed order, contact us within 24 hours of delivery.
        </p>

        <p>
          After verification, we may arrange a replacement, exchange,
          or refund as appropriate.
        </p>

        <p>
          Gloss & Glows will bear the reasonable eligible return
          courier charge where the incorrect product was sent because
          of our fulfilment error.
        </p>
      </PolicySection>

      <PolicySection title="11. Missing Product or Item">
        <p>
          If an order or package is missing an item that should have
          been included, contact us within 24 hours of delivery.
        </p>

        <p>
          Please provide the unboxing video, packaging photographs,
          invoice or order information, and any other relevant
          evidence.
        </p>

        <p>
          Once verified, we may send the missing eligible item or
          provide another appropriate resolution.
        </p>
      </PolicySection>

      <PolicySection title="12. Product Colour, Appearance, and Minor Variation">
        <p>
          Minor differences in colour, shade, packaging, texture,
          lighting, photography, screen display, or normal
          manufacturing variation do not automatically mean that a
          product is defective or incorrect.
        </p>

        <p>
          We will review whether a difference is material based on the
          product description, order information, photographs, and
          other relevant circumstances.
        </p>
      </PolicySection>

      <PolicySection title="13. Inspection of Returned Products">
        <p>
          Returned products may be inspected before a refund,
          replacement, or exchange is approved.
        </p>

        <p>
          The inspection may confirm the product identity, condition,
          completeness, packaging, reported issue, and whether the
          return complies with this policy.
        </p>

        <p>
          A return may be refused if inspection reasonably shows that
          the product was damaged, used, altered, or made ineligible
          after delivery by the customer and the return is not covered
          by another applicable right.
        </p>
      </PolicySection>

      <PolicySection title="14. Refund Processing">
        <p>
          Approved refunds will be processed using a reasonable method
          available to Gloss & Glows and appropriate for the original
          transaction.
        </p>

        <p>
          Where verification or return of the product is required, the
          refund may be processed after the product has been received
          and reviewed.
        </p>

        <p>
          The time taken for funds to appear after we process a refund
          may depend on the payment provider, bank, mobile financial
          service, or other payment method involved.
        </p>
      </PolicySection>

      <PolicySection title="15. Refund Amount">
        <p>
          The amount of an approved refund depends on the reason for
          the return and the amount originally paid or payable for the
          eligible product.
        </p>

        <p>
          For a verified damaged, defective, or incorrect product
          caused by our error, eligible product and approved return
          delivery costs may be handled by Gloss & Glows according to
          the resolution agreed with the customer.
        </p>

        <p>
          For a change-of-mind return, applicable delivery or return
          courier costs remain the customer&apos;s responsibility.
        </p>
      </PolicySection>

      <PolicySection title="16. Exchange and Replacement Availability">
        <p>
          An exchange or replacement depends on stock availability.
        </p>

        <p>
          If the same product is unavailable, we may offer an eligible
          alternative, exchange, refund, or another reasonable
          resolution after discussing the available options with the
          customer.
        </p>
      </PolicySection>

      <PolicySection title="17. Refused or Unaccepted Deliveries">
        <p>
          A customer who changes their mind before accepting an
          otherwise correct parcel may still be responsible for
          applicable delivery or return costs incurred by the order.
        </p>

        <p>
          Repeated intentionally false, fraudulent, abusive, or
          unjustified orders may be handled in accordance with our{" "}
          <Link
            href="/terms"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Terms & Conditions
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="18. How to Request a Return or Refund">
        <p>
          Contact Gloss & Glows customer support and provide enough
          information for us to identify and review the order.
        </p>

        <p>Please include where applicable:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Your name.</li>
          <li>Your phone number.</li>
          <li>Your invoice or order information.</li>
          <li>The reason for the request.</li>
          <li>The unboxing video.</li>
          <li>Product photographs.</li>
          <li>Courier packaging photographs.</li>
          <li>
            Any additional evidence reasonably relevant to the
            request.
          </li>
        </ul>

        <p>
          For damaged, defective, incomplete, or incorrect products,
          make sure the request reaches us within 24 hours of
          receiving the parcel.
        </p>
      </PolicySection>

      <PolicySection title="19. Orders Placed Through the Mobile App">
        <p>
          Purchases made through the official Gloss & Glows Android or
          iOS applications are purchases of physical goods fulfilled
          through the same Gloss & Glows commerce system.
        </p>

        <p>
          Eligible app orders therefore follow this same Refund &
          Return Policy.
        </p>
      </PolicySection>

      <PolicySection title="20. Consumer Rights">
        <p>
          Nothing in this policy is intended to remove or limit any
          mandatory consumer right or remedy that applies under the
          laws of Bangladesh.
        </p>

        <p>
          Where applicable law provides a right that is stronger than
          a voluntary term in this policy, the applicable legal right
          will prevail.
        </p>
      </PolicySection>

      <PolicySection title="21. Changes to This Policy">
        <p>
          We may update this Refund & Return Policy when our products,
          operations, courier arrangements, customer-service
          procedures, or applicable requirements change.
        </p>

        <p>
          The latest version will be published on this page and the
          “Last updated” date will be revised when appropriate.
        </p>
      </PolicySection>

      <PolicySection title="22. Contact Us">
        <p>
          For a damaged product, wrong product, return, replacement,
          exchange, or refund request, contact:
        </p>

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

          <p className="mt-3">
            For delivery information, see our{" "}
            <Link
              href="/shipping-policy"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              Shipping Policy
            </Link>
            .
          </p>
        </div>
      </PolicySection>
    </article>
  );
}