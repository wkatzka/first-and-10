import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Fonts – preload College Block so background canvas can use it on first draw */}
        <link
          rel="preload"
          href="/fonts/CollegeBlock-Mzxn.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&display=swap"
          rel="stylesheet"
        />

        {/* PWA Primary Meta Tags */}
        <meta name="application-name" content="First & 10" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="First & 10" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#111827" />
        
        {/* Favicon & Icons */}
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.svg" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167.svg" />
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* iOS Splash Screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link 
          rel="apple-touch-startup-image" 
          href="/icons/splash-640x1136.png"
          media="(device-width: 320px) and (device-height: 568px)"
        />
        <link 
          rel="apple-touch-startup-image" 
          href="/icons/splash-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px)"
        />
        <link 
          rel="apple-touch-startup-image" 
          href="/icons/splash-1242x2208.png"
          media="(device-width: 414px) and (device-height: 736px)"
        />
        <link 
          rel="apple-touch-startup-image" 
          href="/icons/splash-1125x2436.png"
          media="(device-width: 375px) and (device-height: 812px)"
        />
        
        {/* Prevent zoom on input focus (iOS) */}
        <meta name="format-detection" content="telephone=no" />
      </Head>
      <body className="bg-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
