import { createAuthClient } from "better-auth/react"
import {stripeClient} from "@better-auth/stripe/client";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3001",
    plugins: [
        stripeClient({
            subscription: true //if you want to enable subscription management
        })
    ]
})

export const {
    signIn,
    signOut,
    signUp,
    useSession,
    getSession
} = authClient