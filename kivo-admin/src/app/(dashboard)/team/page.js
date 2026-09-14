"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/ui/theme";
import PageHeader from "@/components/ui/PageHeader";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { IconRefresh, IconLoader2, IconPlus, IconX } from "@tabler/icons-react";

export default function TeamPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    position: "",
    phone_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admins")
      .select("id, full_name, position, created_at, user:users(email, role)")
      .order("created_at", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: me } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        setIsSuperAdmin(me?.role === "super_admin");
      }
      fetchTeam();
    }
    init();
  }, [fetchTeam]);

  const handleCreate = async () => {
    setError("");
    if (!form.full_name || !form.email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create admin");
        setSaving(false);
        return;
      }
      setShowForm(false);
      setForm({
        full_name: "",
        email: "",
        password: "",
        position: "",
        phone_number: "",
      });
      fetchTeam();
    } catch (err) {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Admin",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={r.full_name} />
          <div>
            <div style={{ fontWeight: 600 }}>{r.full_name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {r.user?.email || "—"}
            </div>
          </div>
        </div>
      ),
    },
    { key: "position", header: "Position", render: (r) => r.position || "—" },
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <Badge color={r.user?.role === "super_admin" ? C.primary : C.info}>
          {r.user?.role || "admin"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (r) =>
        new Date(r.created_at).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    },
  ];

  const inp = {
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: C.bg,
    border: `1px solid ${C.borderStrong}`,
    borderRadius: 10,
    padding: "11px 13px",
    color: C.text,
    fontSize: 14,
    outline: "none",
  };
  const lbl = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: C.textMuted,
    marginBottom: 6,
    letterSpacing: 0.3,
  };

  return (
    <div>
      <PageHeader
        title="Admin Team"
        subtitle={`${rows.length} admin${rows.length !== 1 ? "s" : ""}`}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={fetchTeam}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "transparent",
                border: `1px solid ${C.borderStrong}`,
                color: C.text,
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <IconRefresh size={16} /> Refresh
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: C.primary,
                  color: "#000",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <IconPlus size={16} /> Add Admin
              </button>
            )}
          </div>
        }
      />

      {!isSuperAdmin && (
        <div
          style={{
            backgroundColor: C.infoFaint,
            border: `1px solid rgba(33,150,243,0.25)`,
            color: C.info,
            fontSize: 13,
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          Only a super admin can add new admins.
        </div>
      )}

      {showForm && (
        <div
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.primary}44`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: C.text,
                margin: 0,
              }}
            >
              Add New Admin
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: "none",
                border: "none",
                color: C.textMuted,
                cursor: "pointer",
              }}
            >
              <IconX size={20} />
            </button>
          </div>
          {error && (
            <div
              style={{
                backgroundColor: C.dangerFaint,
                color: C.danger,
                fontSize: 13,
                padding: 10,
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <label style={lbl}>FULL NAME</label>
              <input
                style={inp}
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label style={lbl}>EMAIL</label>
              <input
                style={inp}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@kivo.com"
              />
            </div>
            <div>
              <label style={lbl}>PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inp, paddingRight: 60 }}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: C.textMuted,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>POSITION</label>
              <input
                style={inp}
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="Operations Manager"
              />
            </div>
            <div>
              <label style={lbl}>PHONE (optional)</label>
              <input
                style={inp}
                value={form.phone_number}
                onChange={(e) =>
                  setForm({ ...form, phone_number: e.target.value })
                }
                placeholder="+237 6XX XXX XXX"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              marginTop: 16,
              backgroundColor: C.primary,
              color: "#000",
              border: "none",
              borderRadius: 10,
              padding: "11px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {saving ? (
              <IconLoader2
                size={16}
                style={{ animation: "kivospin 0.8s linear infinite" }}
              />
            ) : null}{" "}
            Create Admin
            <style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </button>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>
            The new admin can log in immediately with the email and password you
            set here.
          </p>
        </div>
      )}

      <div
        style={{
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 8,
        }}
      >
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <IconLoader2
              size={32}
              color={C.primary}
              style={{ animation: "kivospin 0.8s linear infinite" }}
            />
            <style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No admins." />
        )}
      </div>
    </div>
  );
}
