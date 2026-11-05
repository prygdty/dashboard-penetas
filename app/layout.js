import "./globals.css"; // Baris ini SANGAT PENTING untuk mengaktifkan desain Tailwind

export const metadata = {
  title: "Dashboard Mesin Tetas IoT",
  description: "Sistem Pemantauan Suhu dan Kendali Rak Geser Otomatis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-slate-900 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}