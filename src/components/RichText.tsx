import { toSafeHtml } from "@/lib/rich-text";

/**
 * Renders content written in the admin editor or Excel. It was sanitized when saved;
 * cleaning it again here keeps the page safe even if the database was edited by hand.
 */
export function RichText({ html, className = "" }: { html: string; className?: string }) {
  const safe = toSafeHtml(html);
  if (!safe) return null;
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: safe }} />;
}
