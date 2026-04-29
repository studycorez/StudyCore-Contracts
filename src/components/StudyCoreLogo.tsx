/**
 * StudyCore brand logo. Sourced from /public/studycore-logo.png by default
 * (drop your PNG into the public/ folder at that filename and it will be
 * picked up automatically). Override with NEXT_PUBLIC_LOGO_URL to point at
 * a hosted asset on studycore.net without redeploying.
 */
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || "/studycore-logo.png";

interface Props {
  className?: string;
  height?: number;
  alt?: string;
}

export default function StudyCoreLogo({
  className = "",
  height = 24,
  alt = "StudyCore",
}: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_URL}
      alt={alt}
      style={{ height: `${height}px`, width: "auto" }}
      className={className}
    />
  );
}
