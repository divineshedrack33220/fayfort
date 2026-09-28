import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/dashboard/", "/overview", "/chat", "/profile", "/settings", "/notifications"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}