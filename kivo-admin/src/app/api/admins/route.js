import { createAdminClient, createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// POST /api/admins — create a new admin (super_admin only)
export async function POST(request) {
  // 1. Verify the caller is logged in and is a super_admin
  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Check caller's role
  const { data: caller } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only a super admin can add admins." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { full_name, email, password, position, phone_number } = body;

  if (!full_name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    // 2. Create the auth account (auto-confirmed so they can log in immediately)
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "admin" },
      });
    if (authError) throw authError;

    const newUserId = authData.user.id;
    const username =
      full_name.toLowerCase().replace(/\s+/g, ".") +
      "." +
      Date.now().toString().slice(-4);

    // 3. Create the users row
    const { error: userError } = await adminClient.from("users").insert({
      id: newUserId,
      username,
      password_hash: "managed_by_supabase_auth",
      email: email.trim(),
      phone_number: phone_number || null,
      role: "admin",
      status: "active",
    });
    if (userError) throw userError;

    // 4. Create the admins row
    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .insert({
        user_id: newUserId,
        full_name,
        position: position || "Administrator",
      })
      .select()
      .single();
    if (adminError) throw adminError;

    return NextResponse.json(
      { admin, message: "Admin created successfully" },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create admin: " + err.message },
      { status: 500 },
    );
  }
}
