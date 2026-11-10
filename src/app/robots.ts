import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

/** robots.txt — keep private areas out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/es/dashboard", "/api/", "/login", "/es/login", "/auth/"] },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
