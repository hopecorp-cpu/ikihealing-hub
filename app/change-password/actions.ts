"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";

export async function changeMyPassword(input: { current_password: string; new_password: string }) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { success: false, error: "Chưa đăng nhập" };

  if (!input.new_password || input.new_password.length < 6) {
    return { success: false, error: "Mật khẩu mới phải ≥6 ký tự" };
  }
  if (input.new_password === input.current_password) {
    return { success: false, error: "Mật khẩu mới phải khác mật khẩu cũ" };
  }

  const verifyRes = await auth.auth.signInWithPassword({
    email: user.email!,
    password: input.current_password
  });
  if (verifyRes.error) {
    return { success: false, error: "Mật khẩu hiện tại không đúng" };
  }

  const sb = getServiceClient();
  const { error } = await sb.auth.admin.updateUserById(user.id, {
    password: input.new_password
  });
  if (error) return { success: false, error: error.message };

  return { success: true };
}
