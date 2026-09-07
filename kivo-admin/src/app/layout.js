import './globals.css';

export const metadata = {
  title: 'Kivo Rides — Admin',
  description: 'Admin dashboard for Kivo Rides',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
