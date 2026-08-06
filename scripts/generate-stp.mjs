#!/usr/bin/env node
// Génère un fichier <style>.stp.json à partir d'une photo de référence, via l'API OpenAI (vision).
// Usage : OPENAI_API_KEY=sk-... node scripts/generate-stp.mjs <photo-reference.jpg> <stp/nom-du-style.stp.json>

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const MODEL = "gpt-4o";
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function main() {
  const [imagePath, outputPath] = process.argv.slice(2);

  if (!imagePath || !outputPath) {
    console.error("Usage: node scripts/generate-stp.mjs <photo-reference> <stp/nom-du-style.stp.json>");
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Erreur : la variable d'environnement OPENAI_API_KEY n'est pas définie.");
    process.exit(1);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    console.error(`Format d'image non supporté : ${ext}`);
    process.exit(1);
  }

  const promptText = await fs.readFile(path.join(ROOT, "Prompt1.md"), "utf-8");
  const imageBuffer = await fs.readFile(imagePath);
  const imageDataUrl = `data:${mime};base64,${imageBuffer.toString("base64")}`;

  console.log(`Analyse de ${imagePath} avec ${MODEL}...`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Erreur API OpenAI (${response.status}) : ${errorBody}`);
    process.exit(1);
  }

  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) {
    console.error("Réponse inattendue de l'API :", JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  let stp;
  try {
    stp = JSON.parse(raw);
  } catch {
    console.error("Le modèle n'a pas renvoyé un JSON valide :\n", raw);
    process.exit(1);
  }

  const outAbs = path.isAbsolute(outputPath) ? outputPath : path.join(ROOT, outputPath);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, JSON.stringify(stp, null, 2) + "\n", "utf-8");

  console.log(`STP écrit dans ${outAbs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
