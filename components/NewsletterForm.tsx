"use client";

import { useState } from "react";

interface NewsletterFormProps {
  /** Compact mode for inline CTAs (just email + submit) */
  compact?: boolean;
}

export default function NewsletterForm({ compact = false }: NewsletterFormProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    referralSource: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      setSubmitted(true);
    } catch (err) {
      console.error("[NewsletterForm] Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to subscribe. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-sm border border-gray-200 bg-light p-8 text-center">
        <p className="text-lg font-semibold text-primary">
          Thank you for subscribing!
        </p>
        <p className="mt-2 text-sm text-secondary">
          You should receive a welcome email shortly. If not, check your spam
          folder and mark it as not spam.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          placeholder="Your email address"
          aria-label="Email address"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
          className="flex-1 border border-gray-200 bg-white px-5 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
        />
        <button
          type="submit"
          disabled={submitting}
          className="border border-primary bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Subscribing..." : "Subscribe"}
        </button>
        {error && (
          <p className="text-xs text-red-600 sm:absolute sm:bottom-0">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="newsletter-first-name" className="mb-2 block text-sm text-primary">
            First Name{" "}
            <span className="text-accent">(required)</span>
          </label>
          <input
            id="newsletter-first-name"
            type="text"
            required
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            className="w-full border-0 bg-light px-4 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="newsletter-last-name" className="mb-2 block text-sm text-primary">
            Last Name{" "}
            <span className="text-accent">(required)</span>
          </label>
          <input
            id="newsletter-last-name"
            type="text"
            required
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            className="w-full border-0 bg-light px-4 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="newsletter-email" className="mb-2 block text-sm text-primary">
          Email{" "}
          <span className="text-accent">(required)</span>
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
          className="w-full border-0 bg-light px-4 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="newsletter-referral" className="mb-2 block text-sm text-primary">
          How did you hear about the newsletter?
        </label>
        <select
          id="newsletter-referral"
          value={formData.referralSource}
          onChange={(e) =>
            setFormData({ ...formData, referralSource: e.target.value })
          }
          className="w-full border-0 bg-light px-4 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Would love to hear how you found me!</option>
          <option value="Jacob">Jacob</option>
          <option value="Social Media">Social Media</option>
          <option value="Web Search">Web Search</option>
          <option value="Newsletter Sent to Me">Newsletter Sent to Me</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="border border-secondary bg-secondary px-10 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-primary hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Subscribing..." : "Subscribe"}
      </button>
    </form>
  );
}
