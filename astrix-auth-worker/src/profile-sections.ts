// Hash each returned Bungie component independently; a missing component is not
// interpreted as zero progress. Revisions are bound to the authenticated account.
export async function profileSections(profile: Record<string, unknown>, membership: string, since: Record<string,string> = {}) {
  const revisions: Record<string,string> = {};
  const changed: Record<string,unknown> = {};
  for (const [name, value] of Object.entries(profile)) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${membership}:${name}:${JSON.stringify(value)}`));
    const revision = Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
    revisions[name] = revision;
    if (since[name] !== revision) changed[name] = value;
  }
  return { revisions, changed };
}
