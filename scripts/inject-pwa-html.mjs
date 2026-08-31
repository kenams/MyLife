import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const file = resolve(process.cwd(), "dist/index.html");
let html = await readFile(file, "utf8");

const marker = "<!-- MYLIFE_PWA -->";
const metadata = `${marker}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#07111f" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="MyLife" />
<meta name="application-name" content="MyLife" />
<meta name="description" content="MyLife transforme ta vraie ville en monde ouvert social persistant." />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/mylife-icon.svg" type="image/svg+xml" />`;

if (!html.includes(marker)) {
  html = html.replace(/\s*<meta name="viewport"[^>]*>/i, "");
  if (!html.includes("</head>")) throw new Error("Expo export index.html has no </head>");
  html = html.replace("</head>", `  ${metadata}\n  </head>`);
  await writeFile(file, html, "utf8");
}

console.log("MyLife PWA metadata injected into dist/index.html");
