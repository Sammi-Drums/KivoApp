"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/ui/theme";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/DataTable";
import { IconRefresh, IconLoader2 } from "@tabler/icons-react";

const FILTERS = [
  { value: "all", label: "All Drivers" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending Approval" },
  { value: "rejected", label: "Rejected" },
];

export default function DriversPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("drivers")
      .select(
        "id, full_name, phone_number, email, driver_status, approval_status, onboarding_method, driver_category, created_at, city:cities(city_name), approver:admins!drivers_approved_by_fkey(full_name)",
      )
      .order("created_at", { ascending: false });

    if (filter !== "all") query = query.eq("approval_status", filter);

    const { data, error } = await query;
    if (error) {
      // Fallback if the approver join fails (e.g. FK name differs)
      let q2 = supabase
        .from("drivers")
        .select(
          "id, full_name, phone_number, email, driver_status, approval_status, onboarding_method, driver_category, created_at, city:cities(city_name)",
        )
        .order("created_at", { ascending: false });
      if (filter !== "all") q2 = q2.eq("approval_status", filter);
      const { data: d2 } = await q2;
      setDrivers(d2 || []);
    } else {
      setDrivers(data || []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const columns = [
    {
      key: "name",
      header: "Driver",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={row.full_name} />
          <div>
            <div style={{ fontWeight: 600 }}>{row.full_name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {row.email || "—"}
            </div>
          </div>
        </div>
      ),
    },
    { key: "phone_number", header: "Phone" },
    {
      key: "city",
      header: "City",
      render: (row) => row.city?.city_name || "—",
    },
    {
      key: "driver_category",
      header: "Category",
      render: (row) => (
        <Badge color={C.info}>{row.driver_category || "economy"}</Badge>
      ),
    },
    {
      key: "driver_status",
      header: "Status",
      render: (row) => <Badge>{row.driver_status}</Badge>,
    },
    {
      key: "approval_status",
      header: "Approval",
      render: (row) => <Badge>{row.approval_status}</Badge>,
    },
    {
      key: "approved_by",
      header: "Approved By",
      render: (row) =>
        row.approver?.full_name || (
          <span style={{ color: C.textFaint }}>—</span>
        ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (row) =>
        new Date(row.created_at).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={`${drivers.length} driver${drivers.length !== 1 ? "s" : ""} on the platform`}
        actions={
          <button
            onClick={fetchDrivers}
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
        }
      />

      <div
        style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor:
                filter === f.value ? C.primaryFaint : "transparent",
              border: `1px solid ${filter === f.value ? C.primary : C.borderStrong}`,
              color: filter === f.value ? C.primary : C.textMuted,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

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
            <style>{`@keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={drivers}
            onRowClick={(row) => router.push(`/drivers/${row.id}`)}
            emptyText="No drivers found."
          />
        )}
      </div>
    </div>
  );
}
