"use server";

import { APIResponse } from "@workspace/shared/types/api";
import Debug from "@workspace/shared/lib/Debug";
import { redirect } from "next/navigation";
import { getRow } from "@/lib/supabase/orm";
import { Tables } from "@workspace/shared/types/database";
import { createClient } from "@/lib/supabase/client";

export async function login(
  email: string,
  password: string
): Promise<APIResponse<null>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error.message;
    }

    return {
      data: null,
    };
  } catch (err) {
    return Debug.error({
      module: "Auth",
      context: "login",
      message: String(err),
      code: "AUTH_PW_FAILURE",
    });
  }
}

export async function loginWithAzure(): Promise<APIResponse<string>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile offline_access",
        redirectTo: `${process.env.NEXT_PUBLIC_ORIGIN}/auth/callback`,
      },
    });

    if (error) {
      throw error.message;
    }

    return {
      data: data.url,
    };
  } catch (err) {
    return Debug.error({
      module: "Auth",
      context: "loginWithAzure",
      message: String(err),
      code: "AUTH_SSO_FAILURE",
    });
  }
}

export async function signout() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    redirect("/auth/login");
  } catch (err) {
    return Debug.error({
      module: "Auth",
      context: "signout",
      message: String(err),
      code: "AUTH_SIGNOUT_FAILURE",
    });
  }
}

export async function getCurrentUser(): Promise<
  APIResponse<Tables<"users_view">>
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error.message;
    }

    const { data: user, error: userError } = await getRow("users_view", {
      filters: [["id", "eq", data.user.id]],
    });

    if (userError) {
      throw userError.message;
    }

    return {
      data: user,
    };
  } catch (err) {
    return Debug.error({
      module: "Auth",
      context: "loginWithAzure",
      message: String(err),
      code: "AUTH_SSO_FAILURE",
    });
  }
}
