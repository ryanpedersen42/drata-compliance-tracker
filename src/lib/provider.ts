// Best-effort cloud/service provider classification for a monitoring test.
//
// Drata's API doesn't expose a provider field on the test itself - the
// authoritative `providerName` only shows up per-resource, inside the (much
// more expensive to call for every test) failures endpoint. This infers it
// instead from Drata's own test-naming convention (e.g. "AWS IAM Access Key
// Rotation", "GCP Storage Bucket Public Access"), which is free and instant
// at sync time, at the cost of being a heuristic rather than ground truth.
const PROVIDER_PATTERNS: { provider: string; pattern: RegExp }[] = [
  { provider: "AWS", pattern: /^aws\b/i },
  { provider: "Azure", pattern: /^(microsoft )?azure\b/i },
  { provider: "GCP", pattern: /^(google cloud|gcp)\b/i },
  { provider: "Google Workspace", pattern: /^google workspace\b/i },
  { provider: "GitHub", pattern: /^github\b/i },
  { provider: "GitLab", pattern: /^gitlab\b/i },
  { provider: "Bitbucket", pattern: /^bitbucket\b/i },
  { provider: "Okta", pattern: /^okta\b/i },
  { provider: "Azure AD", pattern: /^azure ad\b/i },
];

export function detectProvider(testName: string): string | null {
  const name = testName.trim();
  for (const { provider, pattern } of PROVIDER_PATTERNS) {
    if (pattern.test(name)) return provider;
  }
  return null;
}
