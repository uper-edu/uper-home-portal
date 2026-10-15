import { PageMetadata } from "./PageMetadata";
/** Legacy page call sites share the same metadata contract; page facts stay unchanged. */
interface SEOProps {
  title: string;
  description: string;
  image?: string;
  type?: string;
  keywords?: string;
  canonicalUrl?: string;
  lastUpdated?: string;
  breadcrumbs?: { name: string; url: string }[];
  faqs?: { question: string; answer: string }[];
  courseData?: { name: string; description: string; provider?: string };
  schemaData?: object;
  notFound?: boolean;
  unavailable?: boolean;
}
export function SEO(props: SEOProps) {
  // Static pages use the reviewed trilingual route catalogue. Dynamic CMS headings remain original text.
  // Old hardcoded modification dates, keyword lists and inferred business claims are intentionally omitted.
  return (
    <PageMetadata
      options={{
        title: props.title,
        description: props.description,
        image: props.image,
        type: props.type,
        modified: props.lastUpdated,
        schema:
          props.schemaData &&
          (["FAQPage", "ItemList"].includes(
            (props.schemaData as any)["@type"],
          ) ||
            (props.schemaData as any)["@graph"]?.every(
              (x: any) => x["@type"] === "JobPosting",
            ))
            ? (props.schemaData as any)["@graph"] || [props.schemaData]
            : undefined,
        notFound: props.notFound,
        unavailable: props.unavailable,
      }}
    />
  );
}
