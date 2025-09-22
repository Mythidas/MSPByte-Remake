import { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://partners.sophos.com/favicon.png"),
      new URL(
        "https://assets.sophos.com/X24WTUEQ/at/h5mf9xfw94jv5mmjpzmmbr/sophos-logo-white.svg"
      ),
      new URL("https://uhf.microsoft.com/images/microsoft/RE1Mu3b.png"),
      new URL(
        "https://ww15.autotask.net/AutotaskOnyx/Content/Images/favicon-dark.ico"
      ),
    ],
  },
};

export default nextConfig;
