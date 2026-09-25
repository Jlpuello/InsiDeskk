interface AvatarProps {
  initials: string;
  colorClass: string;
  size?: number;
}

export function Avatar({ initials, colorClass, size = 40 }: AvatarProps) {
  return (
    <span
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white ${colorClass}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
