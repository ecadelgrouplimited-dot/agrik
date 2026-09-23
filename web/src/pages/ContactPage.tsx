import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ApiError } from "../lib/api";
import { Icon } from "../components/Visuals";

type Draft = {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
};

const FALLBACK_TOPICS = [
  "General enquiry",
  "Getting started",
  "Advisory and alerts",
  "Marketplace and selling",
  "Plans and billing",
  "Partnership",
  "Report a problem",
];

const emptyDraft: Draft = { name: "", email: "", phone: "", topic: FALLBACK_TOPICS[0], message: "" };

const MIN_MESSAGE = 20;

export default function ContactPage() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [topics, setTopics] = useState<string[]>(FALLBACK_TOPICS);
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ reference: number; acknowledged: boolean } | null>(null);

  useEffect(() => {
    // The list is server-owned; the fallback just keeps the form usable if it is slow.
    api
      .contactTopics()
      .then((res) => {
        if (res.topics?.length) {
          setTopics(res.topics);
          setDraft((prev) => ({ ...prev, topic: prev.topic || res.topics[0] }));
        }
      })
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (draft.message.trim().length < MIN_MESSAGE) {
      setError(`Give us a little more detail — at least ${MIN_MESSAGE} characters.`);
      return;
    }

    setSending(true);
    try {
      const result = await api.sendContactMessage({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || null,
        topic: draft.topic,
        message: draft.message.trim(),
        website: honeypot,
      });
      setSent({ reference: result.reference, acknowledged: result.acknowledged });
      setDraft({ ...emptyDraft, topic: topics[0] });
    } catch (err) {
      setError((err as ApiError | undefined)?.detail || "We could not send that just now. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <section className="contact-page">
        <div className="contact-done">
          <span className="contact-done-mark" aria-hidden="true">
            <Icon name="check-circle" size={26} />
          </span>
          <h1>Message received</h1>
          <p>
            Thank you. Your reference is <strong>#{sent.reference}</strong>, and our team replies to enquiries within
            about two working days.
          </p>
          <p className="muted">
            {sent.acknowledged
              ? "We have emailed you a copy of what you sent."
              : "We could not email you a copy just now, but your message is safely with us."}
          </p>
          <div className="contact-done-actions">
            <button className="btn" type="button" onClick={() => setSent(null)}>
              Send another message
            </button>
            <Link className="btn ghost" to="/">
              Back to home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="contact-page">
      <div className="contact-intro">
        <h1>Talk to AGRIK</h1>
        <p>
          Whether you are a farmer getting started, a buyer looking for produce, or an organisation wanting to work with
          us, write to us here and a person will read it.
        </p>
        <div className="contact-channels">
          <a className="contact-channel" href="mailto:info@agrik.co">
            <span className="contact-channel-icon">
              <Icon name="sms" size={16} />
            </span>
            <span>
              <strong>info@agrik.co</strong>
              <small>General enquiries and support</small>
            </span>
          </a>
          <Link className="contact-channel" to="/marketplace">
            <span className="contact-channel-icon">
              <Icon name="market" size={16} />
            </span>
            <span>
              <strong>Marketplace</strong>
              <small>Browse produce and services before you write</small>
            </span>
          </Link>
          <Link className="contact-channel" to="/auth/register">
            <span className="contact-channel-icon">
              <Icon name="users" size={16} />
            </span>
            <span>
              <strong>Create an account</strong>
              <small>Most getting-started questions are answered inside</small>
            </span>
          </Link>
        </div>
      </div>

      <form className="contact-form" onSubmit={submit}>
        <div className="contact-form-grid">
          <label className="field">
            Your name
            <input value={draft.name} onChange={(event) => set("name", event.target.value)} required minLength={2} />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              value={draft.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <span className="field-note">We reply to this address.</span>
          </label>
          <label className="field">
            Phone (optional)
            <input
              value={draft.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="+256..."
              autoComplete="tel"
            />
          </label>
          <label className="field">
            What is this about?
            <select value={draft.topic} onChange={(event) => set("topic", event.target.value)}>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
          <label className="field contact-form-span">
            Your message
            <textarea
              rows={6}
              value={draft.message}
              onChange={(event) => set("message", event.target.value)}
              placeholder="Tell us what you need. Include your district and crops if it helps us answer."
              required
            />
            <span className="field-note">
              {draft.message.trim().length < MIN_MESSAGE
                ? `${MIN_MESSAGE - draft.message.trim().length} more characters needed`
                : `${draft.message.trim().length} characters`}
            </span>
          </label>
        </div>

        {/* Not shown to people; anything typed here came from a bot. */}
        <label className="contact-honeypot" aria-hidden="true">
          Website
          <input value={honeypot} onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>

        {error && <p className="status error">{error}</p>}

        <button className="btn contact-submit" type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send message"}
        </button>
        <p className="muted contact-privacy">
          We use what you send only to answer you. We never sell it on.
        </p>
      </form>
    </section>
  );
}
