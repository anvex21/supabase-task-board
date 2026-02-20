import "../App.css";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SubmitEvent,
} from "react";
import { supabase } from "../supabase-client";
import type { Session } from "@supabase/supabase-js";

interface Task {
  id: number;
  title: string;
  description: string;
  created_at: string;
  image_url: string;
}

export default function TaskManager({ session }: { session: Session }) {
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskImage, setTaskImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editDescriptionById, setEditDescriptionById] = useState<
    Record<number, string>
  >({});

  const addTaskToState = (task: Task) => {
    setTasks((prev) =>
      prev.some((existing) => existing.id === task.id) ? prev : [task, ...prev],
    );
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      return;
    }

    startTransition(() => {
      setTasks(data ?? []);
    });
  };

  useEffect(() => {
    void fetchTasks();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tasks-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        (payload) => {
          const inserted = payload.new as Task;
          if (!inserted?.id) {
            return;
          }
          if (!inserted.title || !inserted.description) {
            void supabase
              .from("tasks")
              .select("*")
              .eq("id", inserted.id)
              .single()
              .then(({ data, error }) => {
                if (error || !data) {
                  return;
                }
                addTaskToState(data as Task);
              });
            return;
          }
          addTaskToState(inserted);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const updated = payload.new as Task;
          if (!updated?.id) {
            return;
          }
          setTasks((prev) =>
            prev.map((task) => (task.id === updated.id ? updated : task)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tasks" },
        (payload) => {
          const deleted = payload.old as Task;
          if (!deleted?.id) {
            return;
          }
          setTasks((prev) => prev.filter((task) => task.id !== deleted.id));
        },
      );

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setTaskImage(e.target.files[0]);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const filePath = `${session.user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from("tasks-images")
      .upload(filePath, file);
    if (error) {
      console.error("Error uploading image:", error);
      return null;
    }
    const { data } = supabase.storage
      .from("tasks-images")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!taskImage) {
      return;
    }

    const imageUrl = await uploadImage(taskImage);

    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...newTask, email: session.user.email, image_url: imageUrl })
      .select()
      .single();

    if (error) {
      console.error("Error inserting task:", error);
      return;
    }

    if (data) {
      addTaskToState(data as Task);
    }

    setNewTask({ title: "", description: "" });
    setTaskImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const deleteTask = async (id: number) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("Error deleting task:", error);
    }
  };

  const updateTask = async (id: number) => {
    const description = editDescriptionById[id]?.trim();
    if (!description) {
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ description })
      .eq("id", id);

    if (error) {
      console.error("Error updating task:", error);
      return;
    }

    setEditDescriptionById((prev) => ({ ...prev, [id]: "" }));
  };

  return (
    <div className="tasks-shell">
      <section className="surface-subcard">
        <h2 className="section-title">Create task</h2>
        <p className="section-subtitle">
          Add title, description, and an image.
        </p>

        <form onSubmit={handleSubmit} className="task-form">
          <label className="field-label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            type="text"
            placeholder="Plan API migration"
            value={newTask.title}
            onChange={(e) => {
              setNewTask((prev) => ({ ...prev, title: e.target.value }));
            }}
            className="text-input"
            required
          />

          <label className="field-label" htmlFor="task-description">
            Description
          </label>
          <textarea
            id="task-description"
            placeholder="What needs to be done?"
            value={newTask.description}
            className="text-input text-area"
            onChange={(e) => {
              setNewTask((prev) => ({ ...prev, description: e.target.value }));
            }}
            required
          />

          <label className="field-label" htmlFor="task-image">
            Attach image
          </label>
          <input
            id="task-image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="file-input"
            ref={fileInputRef}
            required
          />
          <p className="field-help">All formats supported, up to 10MB.</p>

          <button type="submit" className="btn btn-primary">
            Add task
          </button>
        </form>
      </section>

      <section className="surface-subcard">
        <h2 className="section-title">Tasks</h2>
        <p className="section-subtitle">Realtime updates are enabled.</p>

        {tasks.length === 0 ? (
          <p className="empty-state">
            No tasks yet. Create your first one above.
          </p>
        ) : (
          <ul className="tasks-list">
            {tasks.map((task) => (
              <li key={task.id} className="task-card">
                <div className="task-top">
                  <h3 className="task-title">{task.title}</h3>
                  <p className="task-date">
                    {new Date(task.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                <p className="task-description">{task.description}</p>

                {task.image_url && (
                  <img
                    src={task.image_url}
                    alt={`Task ${task.title}`}
                    className="task-image"
                  />
                )}

                <div className="task-actions">
                  <textarea
                    placeholder="Write a new description"
                    value={editDescriptionById[task.id] ?? ""}
                    className="text-input text-area"
                    onChange={(e) => {
                      setEditDescriptionById((prev) => ({
                        ...prev,
                        [task.id]: e.target.value,
                      }));
                    }}
                  />
                  <div className="task-btn-row">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        void updateTask(task.id);
                      }}
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        void deleteTask(task.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
