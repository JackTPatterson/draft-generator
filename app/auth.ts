
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { stripe } from "@better-auth/stripe"
import {Stripe} from "stripe";


const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-07-30.basil"
})


export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
        user: 'postgres',
        password: 'changeme'
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false
    },
    plugins: [
        stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
            createCustomerOnSignUp: true,
            subscription: {
                enabled: true,
                plans: [
                    {
                        name: "basic",
                        priceId: "price_1RsrGoDf9iXxvms37lIoiMUO", // the price ID from stripe
                        // annualDiscountPriceId: "price_1234567890", // (optional) the price ID for annual billing with a discount
                        limits: {
                            emails: 500,
                        }
                    },
                    {
                        name: "pro",
                        priceId: "price_1RsrH2Df9iXxvms3KWeEbyJx",
                        limits: {
                            emails: 5000,
                        },
                        freeTrial: {
                            days: 14,
                        }
                    }
                ]
            }
        })
    ],
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL
})