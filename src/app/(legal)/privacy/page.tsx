import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${siteConfig.name}, operated by Trendy Deal BD.`,
  alternates: {
    canonical: "/privacy",
  },
};

const LAST_UPDATED = "August 9, 2026";

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

export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-9">
      <header className="space-y-4 border-b border-slate-200 pb-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Gloss & Glows
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Privacy Policy
          </h1>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          This Privacy Policy explains how Gloss & Glows, operated by
          Trendy Deal BD, collects, uses, stores, shares, and protects
          information when you use our website, mobile applications,
          shopping services, and related services.
        </p>

        <p className="text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <PolicySection title="1. Who We Are">
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
      </PolicySection>

      <PolicySection title="2. Services Covered by This Policy">
        <p>
          This policy applies when you use the Gloss & Glows website,
          our Android or iOS applications, product pages, checkout
          services, push notifications, customer support, and other
          services that link to this Privacy Policy.
        </p>
      </PolicySection>

      <PolicySection title="3. Information We Collect">
        <p>
          We collect only information that is reasonably necessary to
          provide, protect, improve, and operate our shopping and
          delivery services.
        </p>

        <h3 className="font-semibold text-slate-950">
          Information you provide
        </h3>

        <ul className="list-disc space-y-2 pl-5">
          <li>Your name.</li>
          <li>Your mobile phone number.</li>
          <li>Your delivery address.</li>
          <li>Your selected delivery area.</li>
          <li>
            Products, quantities, prices, and other order details.
          </li>
          <li>
            Notes or instructions that you voluntarily provide with
            an order.
          </li>
          <li>
            Information you provide when contacting customer support.
          </li>
        </ul>

        <h3 className="font-semibold text-slate-950">
          Information collected automatically
        </h3>

        <p>
          When you access our website or mobile application, certain
          technical information may be processed automatically for
          security, functionality, troubleshooting, analytics, and
          service operation. This may include:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>IP address and network information.</li>
          <li>Browser or WebView type.</li>
          <li>Operating system and device platform.</li>
          <li>App version and basic device information.</li>
          <li>
            Pages or products viewed and interactions with our
            storefront.
          </li>
          <li>
            Technical logs, timestamps, errors, and security events.
          </li>
        </ul>

        <h3 className="font-semibold text-slate-950">
          Push notification information
        </h3>

        <p>
          If you install the Gloss & Glows mobile application and
          allow notifications, the app may process a device or push
          notification token and notification interaction information
          so that we can send notifications such as new-product
          alerts.
        </p>

        <p>
          You can disable push notifications at any time through your
          device settings.
        </p>
      </PolicySection>

      <PolicySection title="4. How We Use Information">
        <p>We may use information to:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Create and process customer orders.</li>
          <li>Arrange delivery of purchased products.</li>
          <li>Contact you regarding an order or delivery.</li>
          <li>Provide customer support.</li>
          <li>Prevent duplicate, fraudulent, or abusive orders.</li>
          <li>
            Maintain the security and reliability of our website,
            application, and systems.
          </li>
          <li>
            Diagnose errors and improve service performance.
          </li>
          <li>
            Measure product and advertising performance where
            permitted.
          </li>
          <li>
            Send new-product or service notifications when you have
            enabled notifications.
          </li>
          <li>
            Meet legal, regulatory, accounting, or security
            obligations where applicable.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="5. Orders and Checkout">
        <p>
          Our public checkout may require your name, phone number,
          address, delivery area, and order details so that we can
          create and fulfil your order.
        </p>

        <p>
          The current public checkout does not require you to create a
          customer account.
        </p>

        <p>
          The current checkout does not ask you to submit payment card
          credentials directly to Gloss & Glows.
        </p>
      </PolicySection>

      <PolicySection title="6. Advertising and Measurement">
        <p>
          Our website and services may use advertising and measurement
          technologies, including Meta technologies such as Meta Pixel
          and server-side Conversions API, to understand advertising
          performance, measure conversions, improve campaigns, prevent
          duplicate event reporting, and understand how customers
          interact with our storefront.
        </p>

        <p>
          Depending on the platform, device settings, applicable
          requirements, and the permissions or choices you provide,
          these technologies may process information such as product
          interactions, order or purchase events, browser or device
          information, IP address, and limited customer information
          used for matching or measurement.
        </p>

        <p>
          Where consent or platform permission is required for
          tracking, we will use applicable consent or permission
          controls. Declining optional tracking will not prevent you
          from browsing products or placing an order.
        </p>
      </PolicySection>

      <PolicySection title="7. Push Notifications">
        <p>
          Our mobile applications may use Google Firebase Cloud
          Messaging and platform notification services provided by
          Google and Apple to deliver notifications.
        </p>

        <p>
          Notifications are optional. Your device will allow you to
          grant, deny, or later revoke notification permission.
        </p>

        <p>
          Notifications may include new-product alerts, important
          service information, or other Gloss & Glows updates that are
          appropriate for the notification permission you have
          granted.
        </p>
      </PolicySection>

      <PolicySection title="8. When We Share Information">
        <p>
          We do not sell your personal information as a customer
          database.
        </p>

        <p>
          Information may be shared only where reasonably necessary
          with service providers or other parties that help us
          operate the service, including:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>
            Courier and delivery providers that need customer and
            delivery information to fulfil an order.
          </li>
          <li>
            Cloud hosting and infrastructure providers used to run
            our website and backend systems.
          </li>
          <li>
            Media hosting providers used to deliver product images
            and videos.
          </li>
          <li>
            Push notification providers used to deliver app
            notifications.
          </li>
          <li>
            Advertising and measurement providers where permitted,
            including Meta.
          </li>
          <li>
            Security, fraud-prevention, technical, or professional
            service providers where reasonably necessary.
          </li>
          <li>
            Government authorities or other parties where disclosure
            is required by applicable law or a valid legal process.
          </li>
        </ul>

        <p>
          We expect service providers that process information on our
          behalf to use appropriate safeguards and to process the
          information only for permitted purposes.
        </p>
      </PolicySection>

      <PolicySection title="9. Cookies, Local Storage, and Similar Technologies">
        <p>
          Our website or application WebView may use cookies, local
          storage, session storage, pixels, and similar technologies
          for functions such as maintaining service state,
          remembering technical preferences, security, measuring
          performance, and advertising measurement.
        </p>

        <p>
          Some optional advertising or tracking technologies may be
          controlled by consent choices, browser controls, device
          settings, or platform privacy permissions where applicable.
        </p>
      </PolicySection>

      <PolicySection title="10. Data Retention">
        <p>
          Gloss & Glows uses an administrative retention process designed
          to delete or anonymize eligible customer and order-related
          personal information after approximately three months, or
          within approximately 90 days. An authorized administrator
          periodically performs this cleanup from the OMS after
          reviewing and, where appropriate, exporting the affected
          records.
        </p>

        <p>
          Some limited information may need to be retained for a
          longer period where reasonably necessary for legal
          compliance, accounting obligations, fraud prevention,
          security investigations, dispute resolution, enforcement of
          agreements, or other legitimate obligations.
        </p>

        <p>
          Information retained for one of these limited purposes will
          not be kept longer than reasonably necessary for that
          purpose.
        </p>
      </PolicySection>

      <PolicySection title="11. Data Deletion Requests">
        <p>
          The Gloss & Glows public shopping service currently does not
          require customers to create an account.
        </p>

        <p>
          Customer and order-related personal information is also
          subject to our approximately three-month retention
          process described above.
        </p>

        <p>
          If you want us to review or delete eligible personal
          information earlier, you may contact us at{" "}
          <a
            href="mailto:trendysarverbd@gmail.com"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            trendysarverbd@gmail.com
          </a>
          .
        </p>

        <p>
          We may ask for reasonable information to verify that the
          request relates to you before acting on it. Certain records
          may be retained where required for legitimate legal,
          accounting, fraud-prevention, security, or dispute purposes.
        </p>

        <p>
          You can also review our dedicated{" "}
          <Link
            href="/data-deletion"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Data Deletion page
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="12. Security">
        <p>
          We use reasonable technical and organizational measures
          designed to protect personal information against
          unauthorized access, loss, misuse, alteration, or
          disclosure.
        </p>

        <p>
          These measures may include encrypted HTTPS connections,
          access controls, server-side credential protection,
          restricted administrative access, logging, and security
          monitoring.
        </p>

        <p>
          No internet-connected service can guarantee absolute
          security, but we work to maintain safeguards appropriate to
          the information we process.
        </p>
      </PolicySection>

      <PolicySection title="13. Children's Privacy">
        <p>
          Gloss & Glows is a general shopping service and is not
          specifically directed to children.
        </p>

        <p>
          Children should use the service only with the involvement
          and permission of a parent or legal guardian where required
          by applicable law.
        </p>

        <p>
          We do not knowingly design our service to request personal
          information from children for behavioral advertising.
        </p>
      </PolicySection>

      <PolicySection title="14. Your Choices">
        <p>Depending on how you use our services, you can:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>
            Choose whether to provide optional information.
          </li>
          <li>
            Disable mobile push notifications through your device
            settings.
          </li>
          <li>
            Use available browser or device privacy controls.
          </li>
          <li>
            Decline optional tracking where a consent or permission
            control is presented.
          </li>
          <li>
            Contact us about eligible personal-data deletion or
            privacy questions.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="15. Third-Party Websites and Services">
        <p>
          Our services may contain links to third-party websites,
          social platforms, courier services, or other external
          services. Their privacy practices are governed by their own
          policies.
        </p>

        <p>
          We encourage you to review the privacy information provided
          by those third parties when interacting directly with their
          services.
        </p>
      </PolicySection>

      <PolicySection title="16. International Processing">
        <p>
          Some technology providers supporting our website or mobile
          applications may process information on infrastructure
          located outside Bangladesh.
        </p>

        <p>
          Where this occurs, we seek to use reputable providers and
          appropriate safeguards consistent with the nature of the
          information being processed.
        </p>
      </PolicySection>

      <PolicySection title="17. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy when our services,
          technologies, legal requirements, or data practices change.
        </p>

        <p>
          The latest version will be published at this page and the
          â€œLast updatedâ€ date will be revised when appropriate.
        </p>

        <p>
          If a change materially affects how we use personal
          information, we may provide additional notice where
          appropriate.
        </p>
      </PolicySection>

      <PolicySection title="18. Contact Us">
        <p>
          For privacy questions, data requests, or concerns about this
          Privacy Policy, contact:
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
        </div>
      </PolicySection>
    </article>
  );
}
