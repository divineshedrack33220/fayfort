import type { MetadataRoute } from "next";
import { getSession } from "@/lib/session";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const session = await getSession();
  const admin = session?.role === "admin";
  return {
    id: "/",
    name: admin ? "Fayfort Admin" : "Fayfort Sourcing",
    short_name: admin ? "Fayfort Admin" : "Fayfort",
    description:
      "Know what your China purchase will really cost before you buy. Estimate your landed cost, understand your margins, and source with confidence.",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#ffffff",
    theme_color: "#031a45",
    categories: ["business", "productivity", "shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Notifications", short_name: "Alerts", url: "/notifications" },
      { name: "Chat with sourcing team", short_name: "Chat", url: "/chat" },
      { name: "Admin messages", short_name: "Messages", url: "/admin/messages" },
    ],
  };
}
