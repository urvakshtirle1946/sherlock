import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Sherlock Candidate Identifier — Biometric and Behavioural Analysis Dashboard',
  description: 'A MERN-stack system that identifies which participant in a live video meeting is the actual candidate by fusing multiple weak signals into a single, explainable, updating confidence score.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full dark antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
