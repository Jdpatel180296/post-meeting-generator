// Utility to extract a meeting platform and link from a calendar event or
// our DB meeting record. The DB uses `meeting_url` for canonical links, but
// calendar events may place links in `location`, `description`, or `summary`.
function extractPlatformAndLink(event) {
  if (!event) return { platform: "unknown", link: null, source: null };

  // Helper to detect platform from a URL
  function detectPlatform(url) {
    if (!url) return "unknown";
    const u = url.toLowerCase();
    if (u.includes("zoom.us")) return "zoom";
    if (u.includes("teams.microsoft.com") || u.includes("teams.live"))
      return "teams";
    if (u.includes("meet.google.com")) return "meet";
    if (u.includes("webex.com")) return "webex";
    return "unknown";
  }

  // Check meeting_url first (canonical field in DB)
  if (event.meeting_url) {
    const platform = detectPlatform(event.meeting_url);
    return { platform, link: event.meeting_url, source: "meeting_url" };
  }

  // Build a combined searchable text from other fields
  const fieldsToCheck = [
    { name: "location", value: event.location },
    { name: "description", value: event.description },
    { name: "summary", value: event.summary },
  ];

  // Patterns for known providers
  const zoomRe = /https?:\/\/(?:www\.)?(?:[\w.-]+\.)?zoom\.us\/[^\s)]+/i;
  const teamsRe =
    /https?:\/\/(?:www\.)?(?:teams\.microsoft\.com|teams\.live|[\w.-]*office\.com)[^\s)]+/i;
  const meetRe = /https?:\/\/(?:www\.)?meet\.google\.com\/[^\s)]+/i;
  const anyLinkRe = /https?:\/\/[^\s)]+/i;

  for (const field of fieldsToCheck) {
    if (!field.value) continue;
    const text = String(field.value);

    const zoom = text.match(zoomRe);
    if (zoom) return { platform: "zoom", link: zoom[0], source: field.name };

    const teams = text.match(teamsRe);
    if (teams) return { platform: "teams", link: teams[0], source: field.name };

    const meet = text.match(meetRe);
    if (meet) return { platform: "meet", link: meet[0], source: field.name };

    const anyLink = text.match(anyLinkRe);
    if (anyLink)
      return { platform: "unknown", link: anyLink[0], source: field.name };
  }

  return { platform: "unknown", link: null, source: null };
}

module.exports = { extractPlatformAndLink };
