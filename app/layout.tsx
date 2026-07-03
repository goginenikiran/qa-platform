import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Copilot",
  description: "Enterprise Test Case Management with AI-Powered Generation, Execution Tracking, and Reporting",
  keywords: ["QA", "testing", "test cases", "automation", "AI", "ServiceNow"],
  openGraph: {
    title: "QA Copilot",
    description: "Enterprise-grade Test Case Management System",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
