"use client";

import { useState, useEffect } from "react";

interface ContactFormProps {
  buildingName?: string;
  variant?: "default" | "landing";
}

export default function ContactForm({ buildingName, variant = "default" }: ContactFormProps) {
  const isLanding = variant === "landing";

  const [formData, setFormData] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    interest: "buy",
    selectedService: "",
    referralSource: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        email: formData.email,
        phone: formData.phone,
        message: formData.message,
        buildingName,
      };

      if (isLanding) {
        payload.name = `${formData.firstName} ${formData.lastName}`.trim();
        payload.interests = formData.selectedService ? [formData.selectedService] : [];
        payload.referralSource = formData.referralSource;
      } else {
        payload.name = formData.name;
        payload.interest = formData.interest;
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Contact form error:", err);
      setError("Failed to send message. Please try again or email jacob@jacobinaustin.com directly.");
    } finally {
      setSubmitting(false);
    }
  };

  // Landing variant
  if (isLanding) {
    const inputClass = "w-full border-0 bg-white/20 px-4 py-3 text-sm text-white placeholder-white/50 outline-none transition-colors focus:bg-white/30";

    return (
      <section className="section-padding" id="inquiry">
        <div
          className="relative mx-auto max-w-3xl bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/wood3.jpg')" }}
        >
          <div className="absolute inset-0 bg-black/[0.77]" />
          <div className="relative z-10 px-8 py-20 md:px-16 md:py-32 lg:px-24">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              GET IN TOUCH
            </h2>
            <p className="mt-3 text-white/70">
              Fill out the form below and Jacob will get in touch with you as soon as possible.
            </p>

            {submitted ? (
              <div className="mt-10 rounded-sm bg-white/10 p-12 text-center">
                <p className="text-lg font-semibold text-white">Thank you!</p>
                <p className="mt-2 text-sm text-white/70">
                  Jacob will be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                {error && (
                  <div className="rounded-sm border border-red-400/50 bg-red-900/30 p-4 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {/* Name */}
                <div>
                  <p className="mb-2 text-sm font-medium text-white/80">Name</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-white/60">
                        First Name <span className="text-white/40">(required)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">
                        Last Name <span className="text-white/40">(required)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Email <span className="text-white/40">(required)</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Phone <span className="text-white/40">(required)</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>

                {/* Services - Radio buttons */}
                <div>
                  <p className="mb-3 text-sm font-medium text-white/80">
                    What services are you interested in?
                  </p>
                  <div className="flex flex-col gap-3">
                    {["BUY", "SELL", "LEASE"].map((option) => (
                      <label key={option} className="flex cursor-pointer items-center gap-3 text-sm text-white/80">
                        <input
                          type="radio"
                          name="service"
                          value={option.toLowerCase()}
                          checked={formData.selectedService === option.toLowerCase()}
                          onChange={(e) =>
                            setFormData({ ...formData, selectedService: e.target.value })
                          }
                          className="h-4 w-4 accent-accent"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                {/* How did you hear about us */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    How did you hear about us?
                  </label>
                  <input
                    type="text"
                    value={formData.referralSource}
                    onChange={(e) =>
                      setFormData({ ...formData, referralSource: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    placeholder="Anything else you'd like us to know? We love to hear what excites you about your search!"
                    className={`${inputClass} resize-vertical`}
                  />
                </div>

                <div className="text-center">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-block bg-accent px-10 py-3 text-sm uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Default variant
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
            {error && (
              <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}
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
                placeholder="Tell us what you're looking for..."
                className="w-full resize-none border border-gray-200 bg-white px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full border border-primary bg-primary py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Inquiry"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
