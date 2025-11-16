function extractPlatformAndLink(event) {
  const text = [event.summary, event.description, event.location]
    .filter(Boolean)
    .join(" ");

  // Zoom
  const zoom = text.match(/https?:\/\/[^\s]*zoom\.us\/[^\s)]+/i);
  if (zoom) return { platform: "zoom", link: zoom[0] };

  // Teams (common forms: teams.microsoft.com or via meeting link with .office.com)
  const teams = text.match(
    /https?:\/\/[^\s]*(teams\.microsoft|teams\.live|office\.com)[^\s)]+/i
  );
  if (teams) return { platform: "teams", link: teams[0] };

  // Google Meet
  const meet = text.match(/https?:\/\/meet\.google\.com\/[^\s)]+/i);
  if (meet) return { platform: "meet", link: meet[0] };

  return { platform: "unknown", link: null };
}

module.exports = { extractPlatformAndLink };
