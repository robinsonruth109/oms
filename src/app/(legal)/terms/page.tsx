import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and Conditions for shopping with ${siteConfig.name}, operated by Trendy Deal BD.`,
  alternates: {
    canonical: "/terms",
  },
};

const LAST_UPDATED = "August 8, 2026";

function TermsSection({
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

export default function TermsPage() {
  return (
    <article className="space-y-9">
      <header className="space-y-4 border-b border-slate-200 pb-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Gloss & Glows
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Terms & Conditions
          </h1>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          These Terms & Conditions govern your use of the Gloss &
          Glows website, Android and iOS applications, checkout
          services, product pages, customer support, and related
          shopping services operated by Trendy Deal BD.
        </p>

        <p className="text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <TermsSection title="1. About Gloss & Glows">
        <p>
          Gloss & Glows is an online shopping service operated by
          Trendy Deal BD in Bangladesh.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-semibold text-slate-950">
                Brand
              </dt>
              <dd>Gloss & Glows</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Operator
              </dt>
              <dd>Trendy Deal BD</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Website
              </dt>
              <dd>https://glossandglows.com</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Email
              </dt>
              <dd>
                <a
                  href="mailto:trendysarverbd@gmail.com"
                  className="font-medium text-slate-950 underline underline-offset-4"
                >
                  trendysarverbd@gmail.com
                </a>
              </dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Phone
              </dt>
              <dd>
                <a
                  href="tel:+8801303559063"
                  className="font-medium text-slate-950 underline underline-offset-4"
                >
                  +8801303559063
                </a>
              </dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-950">
                Address
              </dt>
              <dd>
                37/2, Lane-1, Block-A, Section-6, Mirpur, Dhaka,
                Bangladesh
              </dd>
            </div>
          </dl>
        </div>
      </TermsSection>

      <TermsSection title="2. Acceptance of These Terms">
        <p>
          By accessing or using Gloss & Glows, browsing products,
          placing an order, or otherwise using our services, you agree
          to these Terms & Conditions and our applicable policies.
        </p>

        <p>
          If you do not agree with these terms, you should not place
          an order or use the service.
        </p>

        <p>
          Our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          ,{" "}
          <Link
            href="/shipping-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Shipping Policy
          </Link>
          , and{" "}
          <Link
            href="/refund-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Refund & Return Policy
          </Link>{" "}
          form part of the rules governing use of our shopping
          service.
        </p>
      </TermsSection>

      <TermsSection title="3. Eligibility">
        <p>
          You must be legally capable of entering into a purchase
          transaction under applicable law.
        </p>

        <p>
          If you are under the age at which you can independently
          enter into such a transaction, you should use the service
          only with the involvement and permission of a parent or
          legal guardian.
        </p>
      </TermsSection>

      <TermsSection title="4. Customer Accounts">
        <p>
          The current Gloss & Glows public shopping and checkout
          service does not require customers to create an account.
        </p>

        <p>
          You are responsible for providing accurate information when
          placing an order, including your name, mobile number,
          delivery address, and delivery-area information.
        </p>
      </TermsSection>

      <TermsSection title="5. Products">
        <p>
          We try to display product titles, descriptions, images,
          videos, prices, variations, availability, and other
          information as accurately as reasonably possible.
        </p>

        <p>
          Product appearance may vary slightly because of lighting,
          photography, screen settings, manufacturing variation,
          packaging changes, or other reasonable differences.
        </p>

        <p>
          Product availability may change without notice.
        </p>

        <p>
          Nothing on a product page should be interpreted as a medical
          diagnosis, treatment recommendation, or professional advice
          unless expressly stated and legally appropriate.
        </p>
      </TermsSection>

      <TermsSection title="6. Prices">
        <p>
          Product prices are displayed in Bangladeshi Taka unless
          otherwise stated.
        </p>

        <p>
          The final payable amount may include the product price,
          delivery charge, discounts, advance amounts where
          applicable, or other charges clearly shown before order
          confirmation.
        </p>

        <p>
          We may change product prices, promotional prices, or
          delivery charges at any time before an order is accepted.
        </p>

        <p>
          If a product or price is displayed incorrectly because of a
          technical, typographical, configuration, or other genuine
          error, we may contact you to correct the order or cancel it
          before fulfilment.
        </p>
      </TermsSection>

      <TermsSection title="7. Placing an Order">
        <p>
          When you submit an order through Gloss & Glows, you are
          making a request to purchase the selected products using the
          information you provided.
        </p>

        <p>
          Submission of the checkout form does not always guarantee
          immediate acceptance or shipment of an order.
        </p>

        <p>
          We may verify an order by phone, message, system checks, or
          other reasonable methods before dispatch.
        </p>

        <p>
          Orders may be subject to stock availability, delivery-area
          availability, fraud or duplicate-order checks, customer
          confirmation, and other operational requirements.
        </p>
      </TermsSection>

      <TermsSection title="8. Order Information">
        <p>
          You agree to provide correct and reasonably complete order
          information.
        </p>

        <p>
          This includes, where requested:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Customer name.</li>
          <li>A working Bangladesh mobile phone number.</li>
          <li>A sufficiently complete delivery address.</li>
          <li>The correct delivery area.</li>
          <li>Product and quantity selections.</li>
          <li>
            Any delivery instruction needed to complete the order.
          </li>
        </ul>

        <p>
          We are not responsible for delays or unsuccessful delivery
          caused primarily by materially incorrect or incomplete
          information provided by the customer.
        </p>
      </TermsSection>

      <TermsSection title="9. Order Confirmation">
        <p>
          We may contact you to confirm an order before sending it for
          delivery.
        </p>

        <p>
          An order may be placed on hold or cancelled if we cannot
          reasonably verify necessary order information, if the
          product becomes unavailable, or where the order appears to
          be fraudulent, duplicated, abusive, or otherwise invalid.
        </p>
      </TermsSection>

      <TermsSection title="10. Payment">
        <p>
          Available payment methods may vary depending on the product,
          delivery area, promotion, or service configuration.
        </p>

        <p>
          Where Cash on Delivery is offered, the amount due must be
          paid according to the delivery arrangement.
        </p>

        <p>
          If advance payment or another payment method is offered in
          the future, any applicable instructions and conditions will
          be presented to the customer before payment.
        </p>

        <p>
          The Gloss & Glows mobile applications sell physical goods.
          Purchases of physical products are fulfilled outside the app
          through our commerce and delivery process.
        </p>
      </TermsSection>

      <TermsSection title="11. Delivery">
        <p>
          Delivery availability, timing, and charges may depend on
          your address, courier availability, product availability,
          holidays, weather, traffic, operational conditions, or
          other circumstances.
        </p>

        <p>
          Any delivery estimate is an estimate rather than a
          guaranteed arrival time unless we explicitly state
          otherwise.
        </p>

        <p>
          More information is available in our{" "}
          <Link
            href="/shipping-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Shipping Policy
          </Link>
          .
        </p>
      </TermsSection>

      <TermsSection title="12. Order Cancellation">
        <p>
          If you need to cancel or change an order, contact us as soon
          as possible.
        </p>

        <p>
          We will try to assist when operationally possible, but an
          order may no longer be cancellable once it has been packed,
          handed to a courier, or entered a stage where cancellation
          is no longer reasonably possible.
        </p>

        <p>
          We may also cancel an order where reasonably necessary
          because of stock problems, pricing errors, suspected fraud,
          invalid customer information, delivery restrictions, or
          other legitimate operational reasons.
        </p>
      </TermsSection>

      <TermsSection title="13. Returns, Refunds, and Product Problems">
        <p>
          Eligibility for a return, replacement, exchange, or refund
          depends on the circumstances of the order, the condition of
          the product, the type of product, and our applicable policy.
        </p>

        <p>
          Customers should inspect delivered products within a
          reasonable period and contact us promptly if there is a
          genuine problem.
        </p>

        <p>
          Full conditions will be described in our{" "}
          <Link
            href="/refund-policy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Refund & Return Policy
          </Link>
          .
        </p>
      </TermsSection>

      <TermsSection title="14. Promotional Offers">
        <p>
          Discounts, coupons, free-delivery offers, promotional
          prices, campaigns, or other promotions may have separate
          eligibility requirements, time limits, quantity limits, or
          other conditions.
        </p>

        <p>
          Promotions may end or change without notice where permitted,
          but changes will not be used to improperly alter an already
          accepted purchase.
        </p>

        <p>
          Unless expressly stated otherwise, promotional offers cannot
          be converted into cash.
        </p>
      </TermsSection>

      <TermsSection title="15. Push Notifications">
        <p>
          If you install the Gloss & Glows mobile application, you may
          choose whether to allow push notifications.
        </p>

        <p>
          Notifications may include new-product announcements,
          service updates, or other relevant Gloss & Glows
          information.
        </p>

        <p>
          Notification permission is optional and can be disabled
          through your device settings.
        </p>
      </TermsSection>

      <TermsSection title="16. Acceptable Use">
        <p>
          You must not misuse Gloss & Glows or interfere with the
          operation, security, or integrity of our services.
        </p>

        <p>You must not intentionally:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Place fraudulent or intentionally false orders.</li>
          <li>
            Repeatedly place orders with no genuine intention of
            receiving or purchasing them.
          </li>
          <li>
            Attempt to gain unauthorized access to administrative,
            server, database, or internal systems.
          </li>
          <li>
            Introduce malware or deliberately harmful code.
          </li>
          <li>
            Attempt to bypass security, abuse-prevention, or
            rate-limiting measures.
          </li>
          <li>
            Scrape or automatically extract substantial service data
            in a manner that harms or disrupts the service.
          </li>
          <li>
            Use the service for unlawful, deceptive, or abusive
            purposes.
          </li>
        </ul>
      </TermsSection>

      <TermsSection title="17. Intellectual Property">
        <p>
          The Gloss & Glows name, website and application design,
          original text, graphics, software, branding, and other
          materials owned by Trendy Deal BD are protected to the
          extent provided by applicable intellectual-property laws.
        </p>

        <p>
          Product names, trademarks, images, videos, or other content
          belonging to third parties remain the property of their
          respective owners.
        </p>

        <p>
          You may use the storefront for normal personal shopping
          purposes but may not reproduce or commercially exploit our
          proprietary content without permission where permission is
          legally required.
        </p>
      </TermsSection>

      <TermsSection title="18. Third-Party Services">
        <p>
          Gloss & Glows may rely on or interact with third-party
          services, including courier providers, hosting providers,
          media hosting services, notification services, advertising
          platforms, analytics or measurement providers, and other
          operational services.
        </p>

        <p>
          When you independently interact with a third-party service,
          that service may also apply its own terms and privacy
          policies.
        </p>
      </TermsSection>

      <TermsSection title="19. Service Availability">
        <p>
          We work to keep Gloss & Glows available and functional, but
          continuous or error-free operation cannot be guaranteed.
        </p>

        <p>
          The service may occasionally be unavailable because of
          maintenance, updates, hosting problems, network conditions,
          third-party outages, security incidents, or circumstances
          beyond our reasonable control.
        </p>

        <p>
          We may modify, improve, replace, or discontinue features
          where reasonably necessary.
        </p>
      </TermsSection>

      <TermsSection title="20. Limitation of Responsibility">
        <p>
          Nothing in these Terms is intended to exclude or limit any
          right or responsibility that cannot lawfully be excluded
          under applicable law.
        </p>

        <p>
          To the extent permitted by applicable law, Trendy Deal BD is
          not responsible for indirect or consequential losses caused
          by circumstances beyond our reasonable control.
        </p>

        <p>
          We remain responsible for obligations that apply to us under
          applicable consumer-protection and other mandatory laws.
        </p>
      </TermsSection>

      <TermsSection title="21. Privacy">
        <p>
          Our handling of personal information is described in our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p>
          By using Gloss & Glows, you acknowledge that information
          necessary to operate the shopping and delivery service may
          be processed as described in that policy.
        </p>
      </TermsSection>

      <TermsSection title="22. Data Retention and Deletion">
        <p>
          Our current operational policy is designed to automatically
          delete or anonymize eligible customer and order-related
          personal information after approximately three months,
          subject to limited legal, accounting, fraud-prevention,
          security, or dispute-related retention needs.
        </p>

        <p>
          Eligible early deletion requests can be submitted as
          described on our{" "}
          <Link
            href="/data-deletion"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Data Deletion page
          </Link>
          .
        </p>
      </TermsSection>

      <TermsSection title="23. Governing Law">
        <p>
          These Terms & Conditions are governed by the applicable laws
          of Bangladesh.
        </p>

        <p>
          Any dispute will be handled in accordance with applicable
          Bangladesh law and any mandatory consumer rights or dispute
          procedures that apply.
        </p>
      </TermsSection>

      <TermsSection title="24. Changes to These Terms">
        <p>
          We may update these Terms & Conditions when our services,
          policies, technology, operational processes, or legal
          requirements change.
        </p>

        <p>
          The current version will be published on this page and the
          “Last updated” date will be changed when appropriate.
        </p>

        <p>
          Continued use of the service after an updated version takes
          effect means the updated terms will apply to future use,
          subject to applicable law.
        </p>
      </TermsSection>

      <TermsSection title="25. Contact Us">
        <p>
          Questions about an order, these Terms & Conditions, or the
          Gloss & Glows service can be directed to:
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
            You may also use our{" "}
            <Link
              href="/contact"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              Contact page
            </Link>
            .
          </p>
        </div>
      </TermsSection>
    </article>
  );
}