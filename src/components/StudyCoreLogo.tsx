/**
 * StudyCore brand logo. Sourced from /public/studycore-logo.png by default,
 * or override via NEXT_PUBLIC_LOGO_URL (useful for pointing at a hosted asset
 * on studycore.net without redeploying just to swap the image).
 */
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || "/studycore-logo.png";

interface Props {
  className?: string;
  height?: number;
  alt?: string;
}

export default function StudyCoreLogo({
  className = "",
  height = 22,
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
