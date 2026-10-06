import { useState } from "react";
import { Globe2 } from "lucide-react";

export function SiteIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState<string>();
  if (!src || src === failed) return <Globe2 size={15} />;
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
