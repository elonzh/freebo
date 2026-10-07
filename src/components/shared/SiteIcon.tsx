import { useState } from "react";
import { ServerIcon } from "./IntegrationIcon";

export function SiteIcon({ src, providerId }: { src?: string; providerId: string }) {
  const [failed, setFailed] = useState<string>();
  if (!src || src === failed) return <ServerIcon providerId={providerId} className="size-[15px]" />;
  return (
    <img
      src={src}
      width={15}
      height={15}
      alt=""
      className="shrink-0 object-contain"
      draggable={false}
      onError={() => setFailed(src)}
    />
  );
}
