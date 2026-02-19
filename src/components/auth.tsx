import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { supabase } from "../supabase-client";

export const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isAlreadySignedUpMessage = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("already registered") ||
      normalized.includes("already exists") ||
      normalized.includes("already been registered")
    );
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        if (isAlreadySignedUpMessage(signUpError.message)) {
          setErrorMessage("This account is already signed up. Please sign in.");
          return;
        }
        setErrorMessage(signUpError.message);
        return;
      }

      const hasNoNewIdentity = (data.user?.identities?.length ?? 0) === 0;
      if (hasNoNewIdentity) {
        setErrorMessage("This account is already signed up. Please sign in.");
        return;
      }

      setSuccessMessage(
        "Confirmation email sent. Please check your inbox to finish signing up.",
      );
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setErrorMessage(signInError.message);
    }
  };

  const handleOAuthSignIn = async (provider: "google") => {
    setErrorMessage("");
    setSuccessMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="auth-shell">
      <div>
        <h2 className="section-title">{isSignUp ? "Create account" : "Welcome back"}</h2>
        <p className="section-subtitle">
          {isSignUp
            ? "Use email/password to create your account."
            : "Sign in with Google or your email/password."}
        </p>
      </div>

      {!isSignUp && (
        <button
          type="button"
          className="btn btn-google"
          onClick={() => {
            void handleOAuthSignIn("google");
          }}
        >
          Continue with Google
        </button>
      )}

      <div className="auth-divider" role="presentation">
        <span>or use email</span>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="field-label" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setEmail(e.target.value);
          }}
          className="text-input"
          required
        />

        <label className="field-label" htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setPassword(e.target.value);
          }}
          className="text-input"
          required
          minLength={6}
        />

        <button type="submit" className="btn btn-primary btn-full">
          {isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        className="btn btn-ghost btn-full"
        onClick={() => {
          setErrorMessage("");
          setSuccessMessage("");
          setIsSignUp((prev) => !prev);
        }}
      >
        {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
      </button>

      {successMessage && <p className="success-text">{successMessage}</p>}
      {errorMessage && <p className="error-text">{errorMessage}</p>}
    </div>
  );
};
