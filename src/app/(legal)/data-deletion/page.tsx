import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: `Information about personal-data retention and deletion for ${siteConfig.name}, operated by Trendy Deal BD.`,
  alternates: {
    canonical: "/data-deletion",
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

export default function DataDeletionPage() {
  return (
    <article className="space-y-9">
      <header className="space-y-4 border-b border-slate-200 pb-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Gloss & Glows
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Data Deletion & Retention
          </h1>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          This page explains how customers can request deletion of
          eligible personal information associated with Gloss &
          Glows and describes our customer-data retention process.
        </p>

        <p className="text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <PolicySection title="1. No Customer Account Is Required">
        <p>
          Gloss & Glows currently allows customers to browse products
          and place orders without creating a customer account.
        </p>

        <p>
          Because there is no required customer account, there is
          currently no customer account profile that needs to be
          separately deleted.
        </p>

        <p>
          This page instead applies to eligible personal information
          connected with customer orders, checkout activity, customer
          support, mobile application usage, and related services.
        </p>
      </PolicySection>

      <PolicySection title="2. Information That May Be Associated With an Order">
        <p>
          Depending on how you use Gloss & Glows, customer or
          order-related information may include:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Customer name.</li>
          <li>Mobile phone number.</li>
          <li>Delivery address.</li>
          <li>Selected delivery area.</li>
          <li>Products and quantities ordered.</li>
          <li>Order and invoice identifiers.</li>
          <li>Order status and delivery information.</li>
          <li>Customer notes or delivery instructions.</li>
          <li>Customer-support communications.</li>
          <li>
            Technical information reasonably associated with
            operation, security, or measurement of the service.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="3. Our Retention Policy">
        <p>
          Our operational retention policy is designed so that
          eligible customer and order-related personal information is
          deleted or anonymized after approximately three months, or
          approximately 90 days.
        </p>

        <p>
          We are implementing and maintaining technical processes
          intended to support this retention period across the Gloss &
          Glows commerce system.
        </p>

        <p>
          Some limited information may need to be retained for longer
          where reasonably necessary for:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Legal or regulatory obligations.</li>
          <li>Accounting or financial record requirements.</li>
          <li>Fraud prevention.</li>
          <li>Security investigations.</li>
          <li>Dispute resolution.</li>
          <li>Enforcement of legal rights or agreements.</li>
          <li>
            Other legitimate purposes that require limited continued
            retention.
          </li>
        </ul>

        <p>
          Information retained for one of these limited purposes will
          not be kept longer than reasonably necessary for that
          purpose.
        </p>
      </PolicySection>

      <PolicySection title="4. Requesting Earlier Deletion">
        <p>
          You do not have to wait for the normal retention period if
          you want us to review eligible personal information for
          earlier deletion.
        </p>

        <p>
          You can submit a data-deletion request by emailing:
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-950">
            Privacy / Data Deletion
          </p>

          <p className="mt-2">
            Email:{" "}
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
      </PolicySection>

      <PolicySection title="5. Information to Include in Your Request">
        <p>
          To help us identify the correct customer information without
          exposing another customer&apos;s data, please include enough
          information to locate your order.
        </p>

        <p>This may include:</p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Your name used on the order.</li>
          <li>Your mobile number used on the order.</li>
          <li>Your invoice or order number, if available.</li>
          <li>
            The approximate date on which you placed the order.
          </li>
          <li>
            A clear statement that you are requesting deletion of
            eligible personal information.
          </li>
        </ul>

        <p>
          Do not send passwords, payment PINs, OTP codes, or other
          sensitive authentication credentials.
        </p>
      </PolicySection>

      <PolicySection title="6. Identity Verification">
        <p>
          Before deleting personal information, we may take reasonable
          steps to confirm that the request relates to the person whose
          information would be affected.
        </p>

        <p>
          This helps prevent an unauthorized person from deleting or
          accessing another customer&apos;s information.
        </p>

        <p>
          Verification may use information already associated with the
          order, such as the customer mobile number, order identifier,
          or other reasonable order information.
        </p>
      </PolicySection>

      <PolicySection title="7. What We Will Review for Deletion">
        <p>
          Depending on the request and the information held in our
          active systems, eligible data may include:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Customer name.</li>
          <li>Phone number.</li>
          <li>Delivery address.</li>
          <li>Customer notes.</li>
          <li>
            Other customer-identifying order information that is no
            longer required.
          </li>
        </ul>

        <p>
          Where complete deletion of a record is not appropriate
          because a limited business or legal record must remain, we
          may remove or anonymize customer-identifying information
          where reasonably possible.
        </p>
      </PolicySection>

      <PolicySection title="8. Information We May Need to Retain">
        <p>
          A deletion request does not necessarily require removal of
          every technical or business record immediately.
        </p>

        <p>
          We may retain limited information where reasonably necessary
          to:
        </p>

        <ul className="list-disc space-y-2 pl-5">
          <li>Comply with applicable law.</li>
          <li>Maintain required accounting records.</li>
          <li>Resolve an existing dispute.</li>
          <li>Prevent or investigate fraud.</li>
          <li>Protect the security of our systems.</li>
          <li>
            Establish, exercise, or defend legal claims.
          </li>
        </ul>

        <p>
          Retained information will remain subject to appropriate
          access and security controls.
        </p>
      </PolicySection>

      <PolicySection title="9. Courier and Other Service Providers">
        <p>
          When an order has already been shared with a courier or
          another independent service provider for fulfilment, that
          provider may maintain its own legally permitted or required
          records.
        </p>

        <p>
          Gloss & Glows will handle information under our control in
          accordance with this policy and our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-slate-950 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p>
          A third-party provider&apos;s independent retention
          obligations may be governed by its own privacy practices and
          applicable law.
        </p>
      </PolicySection>

      <PolicySection title="10. Push Notification Data">
        <p>
          If you use the official Gloss & Glows mobile application,
          push notification services may use a device or notification
          token to deliver notifications.
        </p>

        <p>
          You can disable notifications through your Android or iOS
          device settings.
        </p>

        <p>
          Mobile notification identifiers under our control will be
          handled in accordance with our active retention and
          notification-management processes.
        </p>
      </PolicySection>

      <PolicySection title="11. Advertising and Measurement Data">
        <p>
          Some information may also be processed by advertising or
          measurement providers where permitted, as described in our
          Privacy Policy.
        </p>

        <p>
          Data already transmitted to an independent platform may also
          be subject to that provider&apos;s own retention and deletion
          policies.
        </p>
      </PolicySection>

      <PolicySection title="12. Backups and Technical Recovery Copies">
        <p>
          Information removed from active production systems may
          remain temporarily in secure backup or disaster-recovery
          copies until those copies are overwritten or expire through
          the normal backup lifecycle.
        </p>

        <p>
          Backup copies are intended for security and disaster
          recovery and are not intended to be used as ordinary active
          customer records.
        </p>
      </PolicySection>

      <PolicySection title="13. How Long a Deletion Request May Take">
        <p>
          We will review eligible deletion requests within a
          reasonable period after receiving enough information to
          identify and verify the relevant customer data.
        </p>

        <p>
          More complex requests, legal retention requirements, or
          insufficient identifying information may require additional
          review.
        </p>
      </PolicySection>

      <PolicySection title="14. Mobile Application Data Deletion">
        <p>
          The same deletion process applies to eligible personal
          information generated through the official Gloss & Glows
          Android and iOS applications.
        </p>

        <p>
          Because the current public application does not require a
          customer account, uninstalling the application does not
          itself create or delete a separate Gloss & Glows customer
          account.
        </p>

        <p>
          Customers who want eligible order-related information
          reviewed before the normal retention period should use the
          deletion-request process described on this page.
        </p>
      </PolicySection>

      <PolicySection title="15. Changes to This Data Deletion Policy">
        <p>
          We may update this page as our systems, retention processes,
          legal obligations, or mobile applications change.
        </p>

        <p>
          The latest version will be published here and the “Last
          updated” date will be revised when appropriate.
        </p>
      </PolicySection>

      <PolicySection title="16. Contact">
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
            Privacy and deletion email:{" "}
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
            For more information about how we process information,
            review our{" "}
            <Link
              href="/privacy"
              className="font-semibold text-slate-950 underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </PolicySection>
    </article>
  );
}