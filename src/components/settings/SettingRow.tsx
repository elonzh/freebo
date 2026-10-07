import type { ReactNode } from "react";

export function SettingRow({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-[25px] border-b py-[18px] max-[650px]:flex-wrap [&>div:first-child]:min-w-0 [&>div:first-child]:flex-1 max-[650px]:[&>div:first-child]:basis-full [&_p]:mt-[5px] [&_p]:text-xs [&_p]:wrap-anywhere">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h3 className="wrap-anywhere">{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
