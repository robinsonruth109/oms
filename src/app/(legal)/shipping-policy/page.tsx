import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: `Shipping and delivery policy for orders placed with ${siteConfig.name}, operated by Trendy Deal BD.`,
  alternates: {
    canonical: "/shipping-policy",
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

export default function ShippingPolicyPage() {
  return (
    <article className="space-y-9">
      <header className="space-y-4 border-b border-slate-200 pb-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Gloss & Glows
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Shipping Policy
          </h1>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          This Shipping Policy explains how physical products ordered
          through Gloss & Glows are prepared, dispatched, delivered,
          and handled throughout Bangladesh.
        </p>

        <p className="text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <PolicySection title="1. About Our Delivery Service">
        <p>
          Gloss & Glows is operated by Trendy Deal BD and sells
          physical products to customers in Bangladesh.
        </p>

        <p>
          Orders may be delivered using third-party courier or
          delivery service providers selected by us based on the
          delivery location, service availability, operational
          requirements, and other relevant factors.
        </p>

        <p>
          Delivery availability is subject to the service coverage of
          our courier partners.
        </p>
      </PolicySection>

      <PolicySection title="2. Delivery Areas">
        <p>
          During checkout, customers may be asked to select the
          delivery area that applies to their address.
        </p>

        <p>
          Our current public checkout distinguishes between:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Delivery inside Dhaka.</li>
          <li>Delivery outside Dhaka.</li>
        </ul>

        <p>
          Customers should select the correct delivery area. Selecting
          an incorrect area may result in a corrected delivery charge,
          a request for confirmation, or a delay while the order
          information is updated.
        </p>
      </PolicySection>

      <PolicySection title="3. Delivery Charges">
        <p>
          The applicable delivery charge is shown during checkout
          before the customer confirms the order.
        </p>

        <p>
          Delivery charges may differ depending on whether the
          delivery address is inside or outside Dhaka and may be
          updated from time to time to reflect courier pricing,
          location, product characteristics, promotions, or other
          operational factors.
        </p>

        <p>
          The delivery charge displayed for the selected delivery area
          at the time an order is submitted will normally be the
          delivery charge recorded with that order.
        </p>

        <p>
          If the customer selects an incorrect delivery area or the
          submitted address requires a different courier charge, we
          may contact the customer before dispatch to confirm any
          necessary correction.
        </p>
      </PolicySection>

      <PolicySection title="4. Order Processing">
        <p>
          After an order is submitted, Gloss & Glows may review or
          verify the order before dispatch.
        </p>

        <p>
          Verification may include checking:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Customer name and mobile number.</li>
          <li>Delivery address.</li>
          <li>Delivery area.</li>
          <li>Product and quantity.</li>
          <li>Product availability.</li>
          <li>Duplicate or potentially invalid orders.</li>
          <li>
            Other information reasonably necessary to fulfil the
            order.
          </li>
        </ul>

        <p>
          An order may remain pending until necessary verification has
          been completed.
        </p>
      </PolicySection>

      <PolicySection title="5. Dispatch">
        <p>
          Once an eligible order has been confirmed and prepared, it
          may be handed to an available courier or delivery provider.
        </p>

        <p>
          Dispatch is subject to product availability, courier
          availability, operating hours, public holidays, weather,
          transportation conditions, and other operational
          circumstances.
        </p>

        <p>
          Submission of an order does not mean that the parcel has
          already been dispatched.
        </p>
      </PolicySection>

      <PolicySection title="6. Estimated Delivery Time">
        <p>
          Delivery times may vary based on the destination, courier,
          dispatch time, public holidays, weather, traffic,
          transportation conditions, and circumstances outside our
          reasonable control.
        </p>

        <p>
          Any delivery date or timeframe communicated by Gloss & Glows
          or a courier should generally be treated as an estimate
          unless we expressly confirm that a particular service has a
          guaranteed delivery commitment.
        </p>

        <p>
          We do not guarantee that every parcel will arrive within an
          identical number of days because delivery conditions differ
          between locations and courier networks.
        </p>
      </PolicySection>

      <PolicySection title="7. Delivery Address">
        <p>
          Customers are responsible for providing a complete and
          accurate delivery address.
        </p>

        <p>
          The address should contain enough information for the
          courier to identify the delivery location. Depending on the
          location, useful address information may include:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>House or holding number.</li>
          <li>Road, lane, or street.</li>
          <li>Area or locality.</li>
          <li>Thana or upazila where relevant.</li>
          <li>District.</li>
          <li>Nearby landmark where useful.</li>
        </ul>

        <p>
          Delivery may be delayed or unsuccessful if materially
          incomplete or incorrect address information is provided.
        </p>
      </PolicySection>

      <PolicySection title="8. Customer Phone Number">
        <p>
          Customers must provide a working Bangladesh mobile number
          when placing an order.
        </p>

        <p>
          Gloss & Glows, our order-confirmation team, or the courier
          may contact the customer using that number to confirm the
          order, locate the delivery address, coordinate delivery, or
          resolve an issue with the parcel.
        </p>

        <p>
          Repeated failure to answer necessary delivery calls may
          prevent successful delivery.
        </p>
      </PolicySection>

      <PolicySection title="9. Courier Providers">
        <p>
          Gloss & Glows may use one or more third-party courier
          providers to fulfil customer deliveries.
        </p>

        <p>
          We may select or change the courier assigned to an order
          where reasonably necessary for delivery availability,
          service coverage, operational efficiency, cost, reliability,
          or other legitimate business reasons.
        </p>

        <p>
          Courier providers may process the customer information
          necessary to perform delivery, such as the recipient name,
          phone number, address, parcel information, and collection
          amount where applicable.
        </p>

        <p>
          More information about our handling of personal information
          is available in our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="10. Cash on Delivery">
        <p>
          Where Cash on Delivery is available, the customer must pay
          the applicable amount to the courier or delivery
          representative according to the order and delivery
          arrangement.
        </p>

        <p>
          The amount may include the product price and applicable
          delivery charge, less any valid discount or advance amount
          already recorded for the order.
        </p>
      </PolicySection>

      <PolicySection title="11. Failed Delivery">
        <p>
          A parcel may be returned or marked as undeliverable if
          delivery cannot reasonably be completed.
        </p>

        <p>Examples may include:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>An incorrect or incomplete address.</li>
          <li>An invalid or unreachable phone number.</li>
          <li>
            The recipient repeatedly being unavailable when delivery
            is attempted.
          </li>
          <li>The customer refusing the parcel without agreement.</li>
          <li>
            The courier being unable to access or service the
            destination.
          </li>
          <li>
            Other circumstances that make completion of delivery
            reasonably impossible.
          </li>
        </ul>

        <p>
          If a parcel is returned, any request for another delivery
          attempt may be subject to availability and an additional
          delivery charge where appropriate.
        </p>
      </PolicySection>

      <PolicySection title="12. Delayed Delivery">
        <p>
          Occasionally a delivery may take longer than expected.
        </p>

        <p>Possible reasons include:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Courier network delays.</li>
          <li>Public holidays or unusually high order volume.</li>
          <li>Severe weather.</li>
          <li>Transport disruption.</li>
          <li>Political or civil disruption.</li>
          <li>Remote or difficult-to-service locations.</li>
          <li>Incomplete customer information.</li>
          <li>Unexpected operational or technical problems.</li>
        </ul>

        <p>
          We will take reasonable steps to assist where we become aware
          of a material delivery problem, but some courier delays may
          be outside our direct control.
        </p>
      </PolicySection>

      <PolicySection title="13. Changing an Address">
        <p>
          If you need to change the delivery address after placing an
          order, contact us as soon as possible.
        </p>

        <p>
          We will try to update the information where operationally
          possible.
        </p>

        <p>
          We cannot guarantee that an address can be changed after the
          parcel has already been dispatched or handed to a courier.
        </p>

        <p>
          An address change that moves the delivery between inside
          Dhaka and outside Dhaka, or otherwise changes the applicable
          courier cost, may result in a revised delivery charge.
        </p>
      </PolicySection>

      <PolicySection title="14. Cancelling Before Delivery">
        <p>
          If you want to cancel an order, contact Gloss & Glows as
          soon as possible.
        </p>

        <p>
          We will try to stop the order if it has not yet reached a
          stage where cancellation is no longer reasonably possible.
        </p>

        <p>
          Once a parcel has been dispatched or transferred to a
          courier, cancellation may be subject to the parcel&apos;s
          current delivery status and courier process.
        </p>
      </PolicySection>

      <PolicySection title="15. Damaged, Incorrect, or Problematic Products">
        <p>
          If you receive a product that appears damaged, incorrect,
          incomplete, or otherwise materially different from your
          confirmed order, contact us as soon as reasonably possible.
        </p>

        <p>
          Please keep the product, packaging, and any relevant evidence
          such as photographs or video where reasonably possible until
          we have reviewed the issue.
        </p>

        <p>
          Return, replacement, exchange, and refund eligibility is
          governed by our{" "}
          <Link
            href="/refund-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Refund & Return Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="16. Delivery Outside Bangladesh">
        <p>
          Unless specifically stated otherwise for a particular
          product or service, the current Gloss & Glows shopping
          service is intended for delivery within Bangladesh.
        </p>

        <p>
          International shipping is not automatically available merely
          because the website or mobile application can be accessed
          from another country.
        </p>
      </PolicySection>

      <PolicySection title="17. Mobile App Orders">
        <p>
          Orders placed through the official Gloss & Glows Android or
          iOS application use the same Gloss & Glows commerce and
          fulfilment system as eligible orders placed through our
          public website.
        </p>

        <p>
          The same applicable delivery area, delivery charge, order
          verification, courier, and shipping rules therefore apply.
        </p>
      </PolicySection>

      <PolicySection title="18. Changes to This Shipping Policy">
        <p>
          We may update this Shipping Policy when courier services,
          delivery areas, operational procedures, charges, technology,
          or applicable requirements change.
        </p>

        <p>
          The latest version will be published on this page and the
          “Last updated” date will be revised when appropriate.
        </p>
      </PolicySection>

      <PolicySection title="19. Contact Us">
        <p>
          For questions about shipping, delivery, or an existing
          order, contact:
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
            You can also review our{" "}
            <Link
              href="/terms"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              Terms & Conditions
            </Link>
            .
          </p>
        </div>
      </PolicySection>
    </article>
  );
}