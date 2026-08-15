import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import "./globals.css";

import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

const metaPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() || "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <head>
        {metaPixelId ? (
          <Script id="fb-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(!f.fbq){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');if(window.__glossMetaPixelId!==${JSON.stringify(metaPixelId)}){fbq('init',${JSON.stringify(metaPixelId)});window.__glossMetaPixelId=${JSON.stringify(metaPixelId)};window.__glossMetaPageViewTracked=false}if(!window.__glossMetaPageViewTracked){var p=window.location.pathname==='/'?'home':window.location.pathname.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'page';var eid='page_view_'+p+'_'+Date.now();fbq('track','PageView',{}, {eventID:eid});window.__glossMetaPageViewTracked=true}`}
          </Script>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
