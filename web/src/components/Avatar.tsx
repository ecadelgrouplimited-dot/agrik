type AvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
  className?: string;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, photoUrl, size = 36, className = "" }: AvatarProps) {
  const classes = ["avatar", className].filter(Boolean).join(" ");
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (photoUrl) {
    return <img className={classes} style={style} src={photoUrl} alt={name ? `${name}'s profile photo` : "Profile photo"} />;
  }

  return (
    <span className={classes} style={style} aria-hidden={name ? undefined : true}>
      {name ? initialsFrom(name) : "?"}
    </span>
  );
}
