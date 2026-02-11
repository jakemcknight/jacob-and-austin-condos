"use client";

import { useState, useEffect } from "react";

interface ContactFormProps {
  buildingName?: string;
}

export default function ContactForm({ buildingName }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "buy",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill message from URL parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const messageParam = urlParams.get("message");
      if (messageParam) {
        setFormData(prev => ({ ...prev, message: messageParam }));
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would submit to an API
    setSubmitted(true);
  };

  return (
    <section className="section-padding" id="inquiry">
      <div className="container-narrow max-w-2xl">
        <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Inquire
        </h2>
        <p className="mb-10 text-center text-secondary">
          {buildingName
            ? `Interested in ${buildingName}? Get in touch.`
            : "Get in touch with Jacob about downtown Austin condos."}
        </p>

        {submitted ? (
          <div className="rounded-sm border border-gray-200 bg-light p-12 text-center">
            <p className="text-lg font-semibold text-primary">Thank you!</p>
            <p className="mt-2 text-sm text-secondary">
              Jacob will be in touch shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-accent">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-white px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-accent">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-white px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-accent">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-white px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-accent">
                  I&apos;m interested in
                </label>
                <select
                  value={formData.interest}
                  onChange={(e) =>
                    setFormData({ ...formData, interest: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-white px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
                >
                  <option value="buy">Buying</option>
                  <option value="sell">Selling</option>
                  <option value="lease">Leasing</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-accent">
                Message
              </label>
              <textarea
                rows={4}
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder={
                  buildingName
                    ? `Tell us about your interest in ${buildingName}...`
                    : "Tell us what you're looking for..."
                }
                className="w-full resize-none border border-gray-200 bg-white px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full border border-primary bg-primary py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
            >
              Send Inquiry
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
