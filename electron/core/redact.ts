export function redact(value: unknown): string {
  return String(value)
    .replace(
      /([?&](?:api_key|token|access_token|X-Emby-Token|password)=)[^&\s"']*/gi,
      "$1[redacted]",
    )
    .replace(
      /((?:Token|Authorization|Cookie|Password|AccessToken)["']?\s*[:=]\s*["']?)[^\n,"'}]+/gi,
      "$1[redacted]",
    );
}
