import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";
import "./App.css";
import { Auth } from "./components/auth";
import TaskManager from "./components/task-manager";

function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="surface-card">
          <header className="app-header">
            <div>
              <p className="app-eyebrow">Alkin Vezhdi</p>
              <h1 className="app-title">Task Board</h1>
            </div>
            {session && (
              <div className="user-controls">
                <span className="user-email">{session.user.email}</span>
                <button type="button" className="btn btn-secondary" onClick={logout}>
                  Log Out
                </button>
              </div>
            )}
          </header>

          {session ? <TaskManager session={session} /> : <Auth />}
        </section>
      </main>
    </div>
  );
}

export default App;
