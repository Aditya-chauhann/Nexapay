import { API_BASE_URL } from "@/lib/api-base";

export interface CaptchaChallenge {
  captchaId: string;
  svg: string;
}

export async function fetchNewCaptcha(): Promise<CaptchaChallenge> {
  const response = await fetch(`${API_BASE_URL}/captcha/new`);
  if (!response.ok) throw new Error("Could not load captcha");
  return response.json();
}
