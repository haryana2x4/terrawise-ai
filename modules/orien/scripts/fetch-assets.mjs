import { mkdir, writeFile, stat } from "node:fs/promises";

const B = "https://images-assets.nasa.gov/image";

const assets = [
  ["iss071e439624", "large", "earth-limb-sunrise.jpg"],
  ["iss045e013851", "large", "earth-night-lights.jpg"],
  ["Artemis II at the pad sunsetting 01292026_13", "large", "artemis-pad.jpg"],
  ["KSC-01172026-Artemis II_Rollout-5", "large", "sls-rollout.jpg"],
  ["iss038e020263", "medium", "spacewalk.jpg"],
  ["PIA15515", "medium", "moon-farside.jpg"],
  ["PIA24921", "medium", "mars-jezero.jpg"],
  ["carina_nebula", "large", "cosmic-cliffs.jpg"],
  ["iss063e010583", "medium", "station.jpg"],
  ["iss072e518423", "medium", "visor-reflection.jpg"],
  ["jsc2025e068207_alt", "medium", "portrait-hathaway.jpg"],
  ["jsc2025e078605_alt", "medium", "portrait-meir.jpg"],
  ["jsc2026e000701_alt", "medium", "portrait-menon.jpg"],
  ["jsc2025e081360_alt", "medium", "portrait-kutryk.jpg"],
  ["jsc2025e058846_alt", "medium", "portrait-esa.jpg"],
  ["jsc2024e022261_alt", "medium", "portrait-cardman.jpg"],
];

await mkdir(new URL("../public/images/", import.meta.url), { recursive: true });

for (const [id, size, name] of assets) {
  const url = `${B}/${id}/${id}~${size}.jpg`;
  try {
    const res = await fetch(encodeURI(url));
    if (!res.ok) {
      console.log(`FAIL ${name} ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(new URL(`../public/images/${name}`, import.meta.url), buf);
    console.log(`ok ${name} ${(buf.length / 1024).toFixed(0)}kb`);
  } catch (e) {
    console.log(`ERR ${name} ${e.message}`);
  }
}
