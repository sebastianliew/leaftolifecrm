/**
 * Single source of truth for brand assets and company identity (issue #16).
 *
 * Logo path can be overridden at build time with NEXT_PUBLIC_LOGO_PATH so the
 * client can swap the logo without a code change. Default falls back to the
 * current asset under /public.
 */
export const BRANDING = {
  companyName: "Leaf to Life Pte Ltd",
  logoPath: process.env.NEXT_PUBLIC_LOGO_PATH || "/logo.jpeg",
  invoiceLogoPath:
    process.env.NEXT_PUBLIC_INVOICE_LOGO_PATH || "/slc-logo.jpeg",
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "www.leaftolife.com",
  email:
    process.env.NEXT_PUBLIC_COMPANY_EMAIL || "customerservice@leaftolife.com.sg",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+65 6538 9978",
  uen: process.env.NEXT_PUBLIC_COMPANY_UEN || "202527780C",
} as const;

export type Branding = typeof BRANDING;
