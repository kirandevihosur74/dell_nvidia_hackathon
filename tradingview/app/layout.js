export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Theming>
          <main>{children}</main>
        </Theming>
      </body>
    </html>
  );
} 