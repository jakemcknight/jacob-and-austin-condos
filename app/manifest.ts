import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jacob In Austin | Downtown Austin High-Rise Expert",
    short_name: "Jacob In Austin",
    description:
      "Downtown Austin high-rise condo expert. Data-driven insight and exclusive resources for buying, selling, or leasing.",
    start_url: "/",
    display: "standalone",
    background_color: "#E1DDD1",
    theme_color: "#191919",
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
