"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage, initials, notifyDataChanged } from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import { Feedback, PageHeader } from "../components/UI";

function ProfileContent() {
  const { profile, userId } = useWorkspace();
  const [name, setName] = useState(profile.full_name || ""),
    [campus, setCampus] = useState(profile.campus || ""),
    [bio, setBio] = useState(profile.bio || ""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error: failure }) => {
      if (failure) setError(failure.message);
      else setEmail(data.user?.email || "Unavailable");
    });
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          campus: campus.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", userId)
        .select("id")
        .single();
      if (result.error) throw result.error;
      notifyDataChanged();
      setMessage("Profile updated successfully.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Your profile"
        description="A familiar face makes campus trading feel better."
      />
      <div className="profile-grid">
        <section className="panel profile-top">
          <div className="avatar">{initials(profile.full_name || "")}</div>
          <h2>{profile.full_name || "Your profile"}</h2>
          <p className="muted small">
            {profile.campus || "Campus not provided"}
          </p>
          <div className="rating-big">
            {(profile.total_reviews ?? 0) > 0
              ? `★ ${Number(profile.trust_score).toFixed(1)}`
              : "—"}
          </div>
          <strong>
            {(profile.total_reviews ?? 0) > 0
              ? `${profile.total_reviews} reviews`
              : "No reviews yet"}
          </strong>
          <p className="muted small reputation-note">
            Your reputation grows with feedback from completed trades.
          </p>
          {profile.bio && <p className="small preserve-lines">{profile.bio}</p>}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Profile information</h2>
          </div>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="form-grid">
                <label className="field full">
                  Full name
                  <input
                    required
                    maxLength={70}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setMessage("");
                    }}
                  />
                  <small>Shown to other traders.</small>
                </label>
                <label className="field full">
                  Email address
                  <input value={email} readOnly />
                  <small>Only visible to you.</small>
                </label>
                <label className="field full">
                  Campus
                  <input
                    maxLength={120}
                    value={campus}
                    onChange={(e) => {
                      setCampus(e.target.value);
                      setMessage("");
                    }}
                  />
                </label>
                <label className="field full">
                  About you
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      setMessage("");
                    }}
                  />
                  <small>
                    Optional. Visible to other traders; keep contact details
                    private.
                  </small>
                </label>
              </div>
            </fieldset>
            <Feedback error={error} message={message} />
            <div className="form-actions">
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
export default function ProfilePage() {
  return (
    <SiteShell>
      <ProfileContent />
    </SiteShell>
  );
}
