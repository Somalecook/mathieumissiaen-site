// Protège /stickoo/app/ par un mot de passe (authentification HTTP Basic).
// Identifiant : stickoo — le mot de passe n'est pas écrit ici, seulement son empreinte SHA-256.
const PASS_SHA256 = "02983ed61c1c75e5cd58cd5c22d808235e8b7b9396635bf15a2b523787492b6f";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(auth.slice(6)).split(":");
      if (user.trim().toLowerCase() === "stickoo" && (await sha256(rest.join(":"))) === PASS_SHA256) {
        return context.next();
      }
    } catch (_e) { /* identifiants illisibles */ }
  }
  return new Response("Stickoo : accès réservé.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Stickoo", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
  });
};

export const config = { path: ["/stickoo/app", "/stickoo/app/*"] };
