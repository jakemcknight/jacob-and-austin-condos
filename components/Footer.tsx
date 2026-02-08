"use client";

const CURRENT_YEAR = 2026;

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-gray-200 bg-primary text-white">
      <div className="container-narrow section-padding">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">
              Jacob In Austin
            </h3>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gray-400">
              Downtown High-Rise Expert
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-300">
              Data-driven insight and exclusive resources for buying, selling,
              and leasing downtown Austin high-rise condos.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Contact
            </h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p>
                <a
                  href="mailto:jacob@jacobinaustin.com"
                  className="transition-colors hover:text-white"
                >
                  jacob@jacobinaustin.com
                </a>
              </p>
              <p>
                <a
                  href="https://www.jacobinaustin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  www.jacobinaustin.com
                </a>
              </p>
              <p className="pt-2 text-gray-400">
                MODUS Real Estate
              </p>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p>
                <a
                  href="https://www.trec.texas.gov/forms/consumer-protection-notice"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  TREC Consumer Protection Notice
                </a>
              </p>
              <p>
                <a
                  href="https://www.trec.texas.gov/forms/information-about-brokerage-services"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  Information About Brokerage Services
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          <p>&copy; {CURRENT_YEAR} Jacob In Austin. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
