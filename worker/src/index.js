// Cloudflare Worker : proxy entre le site statique et l'API Images d'OpenAI.
// La clé OPENAI_API_KEY reste côté serveur (secret Worker), jamais exposée au navigateur.

const PROMPT2 = `Tu es un moteur de transfert de style photographique.

Je fournis :

une photographie source

un fichier photo.stp.json


Le fichier STP représente les caractéristiques photographiques d'une photographie professionnelle.

Le STP est la source de vérité.

Tu ne dois jamais reproduire le sujet de la photographie ayant servi à créer le STP.

Tu dois uniquement reproduire son style photographique.

Tu dois conserver intégralement :

identité

visage

morphologie

expression

coiffure

barbe

lunettes

vêtements

accessoires

pose générale


Ces éléments sont verrouillés.

Tu modifies uniquement :

cadrage

perspective

focale simulée

profondeur de champ

mise au point

éclairage

balance des blancs

colorimétrie

contraste

dynamique

ombres

hautes lumières

texture

rendu de peau

netteté

bruit

grain

bokeh

arrière-plan

ambiance photographique


Lis le STP dans l'ordre défini par "transfer_order".

Pour chaque paramètre :

ignorer les paramètres marqués "unknown"

ignorer les paramètres dont "transferable" vaut false

respecter les priorités CRITICAL, HIGH, MEDIUM puis LOW

appliquer la valeur avec la plus grande fidélité possible


Ne fais preuve d'aucune créativité.

Ne modifie jamais l'identité du sujet.

Le résultat doit donner l'impression que la photographie a été réalisée :

avec le même objectif

avec le même éclairage

avec le même traitement colorimétrique

par le même photographe


Le rendu doit être photoréaliste.

Ne produis aucune explication.

Retourne uniquement l'image finale.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonError("Méthode non autorisée.", 405, corsHeaders);
    }

    try {
      const formData = await request.formData();
      const imageFile = formData.get("image");
      const stpRaw = formData.get("stp");

      if (!(imageFile instanceof File)) {
        return jsonError("Champ 'image' manquant.", 400, corsHeaders);
      }
      if (typeof stpRaw !== "string") {
        return jsonError("Champ 'stp' manquant.", 400, corsHeaders);
      }

      let stp;
      try {
        stp = JSON.parse(stpRaw);
      } catch {
        return jsonError("STP invalide (JSON illisible).", 400, corsHeaders);
      }

      const prompt = `${PROMPT2}\n\nSTP:\n${JSON.stringify(stp)}`;

      const upstreamForm = new FormData();
      upstreamForm.append("model", "gpt-image-1.5");
      upstreamForm.append("prompt", prompt);
      upstreamForm.append("image", imageFile, imageFile.name || "photo.png");
      upstreamForm.append("size", "1024x1024");

      const upstream = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: upstreamForm,
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        return jsonError(`Erreur API OpenAI (${upstream.status}) : ${errText}`, 502, corsHeaders);
      }

      const payload = await upstream.json();
      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        return jsonError("Réponse OpenAI inattendue (pas d'image).", 502, corsHeaders);
      }

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      return new Response(bytes, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "image/png" },
      });
    } catch (err) {
      return jsonError(`Erreur interne : ${err.message}`, 500, corsHeaders);
    }
  },
};

function buildCorsHeaders(origin, env) {
  const allowedList = (env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowOrigin = allowedList.includes("*")
    ? "*"
    : allowedList.includes(origin)
      ? origin
      : allowedList[0] || "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonError(message, status, corsHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
