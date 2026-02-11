"use client";

import Image from "next/image";

const CURRENT_YEAR = 2026;

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#E1DDD1] text-primary">
      <div className="px-[4vw] pt-[20px] pb-[20px]">
        <div className="flex flex-col items-center text-center">
          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/share/g/17SBHvfAS6/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-70"
              aria-label="Facebook"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/jacob-hannusch/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-70"
              aria-label="LinkedIn"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/jacobinaustin_"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-70"
              aria-label="Instagram"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>

          {/* Logo */}
          <div className="mt-3">
            <a href="https://www.jacobinaustin.com/">
              <Image
                src="/downtown-condos/logo-footer.webp"
                alt="Jacob Hannusch"
                width={200}
                height={50}
                className="w-auto"
                style={{ height: "50px" }}
              />
            </a>
          </div>

          {/* Contact Info */}
          <div className="mt-3 space-y-1 text-base font-medium text-primary">
            <p>
              <a href="tel:5127181600" className="hover:opacity-70">(512) 718-1600</a>
            </p>
            <p>
              <a href="mailto:jacob@jacobinaustin.com" className="hover:opacity-70">jacob@jacobinaustin.com</a>
            </p>
            <p>MODUS Real Estate</p>
            <p>Austin, TX</p>
          </div>

          {/* Legal Links */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-sm font-medium text-accent">
            <a
              href="https://www.trec.texas.gov/sites/default/files/pdf-forms/CN%201-5_0.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-70"
            >
              TREC Consumer Protection Notice
            </a>
            <span className="mx-1">|</span>
            <a
              href="https://www.dropbox.com/scl/fi/c0u4dro1fsjrfbmv4au7x/IABS-JACOB-HANNUSCH.pdf?rlkey=acnk1qcm3dofd9kdb6dmls5n5&dl=0"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-70"
            >
              Information About Brokerage Services
            </a>
          </div>

          <div className="mt-6 text-sm font-medium text-primary">
            <p>&copy; {CURRENT_YEAR} Jacob Hannusch. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Decorative brown bars at bottom */}
      <div className="h-[40px] w-full bg-accent" />
      <div className="h-[22px] w-full bg-secondary" />
    </footer>
  );
}
