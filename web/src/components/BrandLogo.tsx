import logo from "../assets/logo_header.webp";
import logoIcon from "../assets/logo_icon.png";

type BrandLogoProps = {
  subtitle?: string;
  className?: string;
  compact?: boolean;
};

export default function BrandLogo({ subtitle, className = "", compact = false }: BrandLogoProps) {
  if (compact) {
    const classes = ["brand-logo", "brand-logo-compact", className].filter(Boolean).join(" ");
    return (
      <span className={classes}>
        <span className="brand-logo-badge">
          <img src={logoIcon} alt="" />
        </span>
        <span className="brand-logo-copy">
          <strong className="brand-logo-wordmark">AGRIK</strong>
          {subtitle ? <span className="brand-logo-subtitle">{subtitle}</span> : null}
        </span>
      </span>
    );
  }

  const classes = ["brand-logo", className].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      <img className="brand-logo-image" src={logo} alt="AGRIK" />
      {subtitle ? <span className="brand-logo-subtitle">{subtitle}</span> : null}
    </span>
  );
}
