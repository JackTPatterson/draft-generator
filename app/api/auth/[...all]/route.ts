import { auth } from "@/app/auth"; // path to your auth file
import { toNextJsHandler } from "better-auth/next-js";

console.log('🔧 Loading better-auth handler...', { baseURL: auth.options?.baseURL });

export const { POST, GET } = toNextJsHandler(auth);