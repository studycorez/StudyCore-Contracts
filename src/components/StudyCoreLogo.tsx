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
      src="/studycore-logo.png"
      alt={alt}
      style={{ height: `${height}px`, width: "auto" }}
      className={className}
    />
  );
}
