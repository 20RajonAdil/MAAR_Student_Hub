import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MAAR Study Hub",
    short_name: "MAAR Study",
    description:
      "A personalised study space that finds what you struggle with, teaches it properly, and tracks your improvement.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6f1",
    theme_color: "#1f6f5c",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
