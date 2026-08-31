import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#07111f" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MyLife" />
        <meta name="application-name" content="MyLife" />
        <meta
          name="description"
          content="MyLife transforme ta vraie ville en monde ouvert social persistant."
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/mylife-icon.svg" type="image/svg+xml" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: #04040A;
            }
            body {
              padding-top: env(safe-area-inset-top);
              padding-right: env(safe-area-inset-right);
              padding-bottom: env(safe-area-inset-bottom);
              padding-left: env(safe-area-inset-left);
            }
            /* Force RN web root to full viewport */
            body > div, #root > div {
              width: 100% !important;
              max-width: 100% !important;
              height: 100% !important;
            }
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
