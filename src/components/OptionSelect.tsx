import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "../lib/utils";

export function OptionSelect<T extends string>({
  value,
  onValueChange,
  options,
  label,
  id,
  name,
  disabled,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(value) => {
        const option = options.find((option) => option.value === value);
        if (option) onValueChange(option.value);
      }}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className={cn("min-w-36", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
