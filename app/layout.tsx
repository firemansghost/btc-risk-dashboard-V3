import './globals.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Bitcoin Risk Dashboard",
  description: "A simple, transparent BTC risk dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="container max-w-6xl py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
