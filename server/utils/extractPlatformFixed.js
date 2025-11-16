// Clean implementation of extractPlatformAndLink — avoids regex literals with embedded newlines.
function extractPlatformAndLink(event) {
  if (!event) return { platform: "unknown", link: null, source: null };

  // check each field individually so we can report which field matched
  const urlBody = "[\\w\\-_.?=&%#()+,/;:@!~'*$\\[\\]]+";
  const zoomRe = new RegExp(
    `https?:\\/\\/(?:www\\.)?(?:[\\w.-]+\\.)?zoom\\.us\\/${urlBody}`,
    "i"
  );
  const teamsRe = new RegExp(
    `https?:\\/\\/(?:www\\.)?(?:teams\\.microsoft\\.com|teams\\.live|[\\w.-]*office\\.com)${urlBody}`,
    "i"
  );
  const meetRe = new RegExp(
    `https?:\\/\\/(?:www\\.)?meet\\.google\\.com\\/${urlBody}`,
    "i"
  );
  const anyRe = new RegExp(`https?:\\/\\/${urlBody}`, "i");

  const fields = [
    { name: "meeting_url", value: event.meeting_url },
    { name: "location", value: event.location },
    { name: "description", value: event.description },
    { name: "summary", value: event.summary },
  ];

  for (const f of fields) {
    if (!f.value) continue;
    const t = String(f.value);
    const zoom = t.match(zoomRe);
    if (zoom) return { platform: "zoom", link: zoom[0], source: f.name };
    const teams = t.match(teamsRe);
    if (teams) return { platform: "teams", link: teams[0], source: f.name };
    const meet = t.match(meetRe);
    if (meet) return { platform: "meet", link: meet[0], source: f.name };
    const any = t.match(anyRe);
    if (any) return { platform: "unknown", link: any[0], source: f.name };
  }

  return { platform: "unknown", link: null, source: null };
}

module.exports = { extractPlatformAndLink };
